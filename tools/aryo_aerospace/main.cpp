// File: /home/kami/ccsds-guard/tools/aryo_aerospace/main.cpp

#include "ccsds_guard/ccsds_guard.hpp"
#include <iostream>
#include <vector>
#include <string>
#include <cstdlib>
#include <sentinel/fs/PathResolver.hpp>
#include <filesystem>

static void print_help()
{
    std::cout << R"(================================================================================
ARYO AEROSPACE: AUTONOMOUS UAV SWARM & SATCOM DEFENSE (ccsds-guard)
================================================================================
Standards: NATO STANAG 4586 (DLI) & CCSDS 133.0-B-2 (Space Data Link Security)
Invariant: Deterministic sub-120 ns verification with zero runtime heap allocation.

Usage:
  aryo aerospace <action> [arguments]

Available Actions:
  bench                   Run the 100,000-sample hardware latency benchmark
  verify-stanag           Test validation of NATO STANAG 4586 telecommand
  verify-ccsds            Test validation of CCSDS 132/133 telecommand frame
  airgap-status           Inspect real-time actuator tripwire latch state
  sim-swarm               Deploy the Autonomous UAV Swarm Tactical Defense Twin
  sim-swarm-down          Teardown the Swarm simulation mesh
  sim-swarm-status        Show running swarm simulation containers
  --plugin-desc           Print single-line extension metadata for master CLI

Examples:
  aryo aerospace bench
  aryo aerospace sim-swarm
  aryo aerospace sim-swarm-status
  aryo aerospace sim-swarm-down
)" << std::endl;
}

