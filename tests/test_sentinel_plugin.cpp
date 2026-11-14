// File: /home/kami/ccsds-guard/tests/test_sentinel_plugin.cpp

#include "sentinel/sdk/abi.hpp"
#include <dlfcn.h>
#include <cassert>
#include <iostream>
#include <vector>
#include <cstring>

static int g_log_count = 0;
static int g_metric_count = 0;

static void mock_log_message(int level, const char* sender, const char* msg) {
    std::cout << "  [HOST_LOG level=" << level << " sender=" << sender << "] " << msg << "\n";
    g_log_count++;
}

static void mock_emit_metric_counter(const char* metric_name, uint64_t delta) {
    std::cout << "  [HOST_METRIC] " << metric_name << " (+" << delta << ")\n";
    g_metric_count += delta;
}

int main() {
    std::cout << "[TEST] blackbox-sentinel Native Plugin ABI Loader Integration...\n";

    const char* plugin_path = "/usr/local/lib/blackbox/ccsds_guard_dissector_plugin.so";
    void* handle = dlopen(plugin_path, RTLD_NOW | RTLD_LOCAL);
    if (!handle) {
        std::cerr << "[-] Error: Failed to dlopen plugin: " << dlerror() << "\n";
        return 1;
    }

    typedef const SentinelPluginDescriptor* (*GetDescriptorFn)(void);
    auto get_desc = reinterpret_cast<GetDescriptorFn>(dlsym(handle, "sentinel_plugin_get_descriptor"));
    assert(get_desc != nullptr);

    const SentinelPluginDescriptor* desc = get_desc();
    assert(desc != nullptr);
    assert(desc->magic == SENTINEL_SDK_MAGIC);
    assert(desc->sdk_version_major == SENTINEL_SDK_VERSION_MAJOR);
    assert(std::string(desc->plugin_id) == "org.aryorithm.plugin.ccsds_guard");

    std::cout << "  [+] Plugin descriptor verified: " << desc->plugin_name << "\n";

    // Setup host interface
    SentinelHostInterface host{};
    host.engine_version = 1;
    host.log_message = mock_log_message;
    host.emit_metric_counter = mock_emit_metric_counter;

    // Initialize plugin
    assert(desc->init_fn != nullptr);
    assert(desc->init_fn(&host) == 0);
    assert(g_log_count >= 1); // Initialization log emitted

    // Synthesize a valid STANAG 4586 packet
    std::vector<uint8_t> packet_buf(32, 0);
    packet_buf[0] = 0x10; packet_buf[1] = 0x01; // Msg Type
    packet_buf[5] = 42;                         // Vehicle ID
    packet_buf[9] = 10;                         // Seq ID 10
    int64_t now_us = 10'000'000;
    for (int i = 0; i < 8; ++i) packet_buf[10 + i] = (now_us >> (56 - 8 * i)) & 0xFF;
    packet_buf[19] = 12;                        // Length

    SentinelRawPacket raw_pkt{};
    raw_pkt.data = packet_buf.data();
    raw_pkt.length = packet_buf.size();
    raw_pkt.timestamp_ns = 10'000'000'000ULL;
    raw_pkt.network_proto = 0x0800; // IPv4
    raw_pkt.transport_proto = 17;   // UDP

    // 1. First invocation: Valid telecommand -> MUST PASS
    SentinelDissectorResult res1 = desc->dissect_fn(&raw_pkt);
    assert(res1.verdict == SENTINEL_VERDICT_PASS);
    std::cout << "  [+] Valid STANAG 4586 packet verdict: PASS\n";

    // 2. Second invocation: Exact replay -> MUST TRIGGER KERNEL DROP
    const int pre_drops = g_metric_count;
    SentinelDissectorResult res2 = desc->dissect_fn(&raw_pkt); // Exact same sequence!
    assert(res2.verdict == SENTINEL_VERDICT_KERNEL_DROP);
    assert(res2.threat_score >= 900);
    assert(res2.rule_id == 0x4586);
    assert(g_metric_count > pre_drops); // Drop counter metric incremented
    std::cout << "  [+] Replayed packet verdict: KERNEL_DROP (Rule: 0x" << std::hex << res2.rule_id << std::dec << ")\n";

    // Shutdown
    assert(desc->shutdown_fn != nullptr);
    desc->shutdown_fn();
    dlclose(handle);

    std::cout << ">>> RESULT: SUCCESS (blackbox-sentinel Native Plugin Loaded & Verified) <<<\n";
    return 0;
}