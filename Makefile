# File: /home/kami/ccsds-guard/Makefile

# ==============================================================================
# ARYORITHM TECHNOLOGIES B.V. — TACTICAL DEFENSE & AEROSPACE SYSTEMS
# Project: ccsds-guard (Autonomous UAV Swarm & Satcom Telecommand Engine)
# Standards: NATO STANAG 4586 (DLI) & CCSDS 133.0-B-2 (Space Link Security)
# Invariant: Sub-120 ns Verification (< 25 ns Monotonicity) | Zero Dynamic Alloc
# ==============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Paths & Directories
PROJECT_DIR  := $(shell pwd)
BUILD_DIR    := $(PROJECT_DIR)/build
SCENARIOS_DIR:= $(PROJECT_DIR)/scenarios/uav_swarm_tactical_defense
MATRIX_DIR   := /home/kami/sentinel-matrix
NEXUS_DIR    := /home/kami/sentinel-nexus
JOBS         ?= $(shell nproc)

# Terminal Colors
CYAN   := \033[1;36m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
RED    := \033[1;31m
WHITE  := \033[1;37m
RESET  := \033[0m

# ==============================================================================
# 1. HELP & DISCOVERY
# ==============================================================================
.PHONY: help
help:
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@echo -e "$(WHITE)  CCSDS-GUARD: AUTONOMOUS UAV SWARM TACTICAL DEFENSE ENGINE$(RESET)"
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@echo -e "Deterministic sub-120 ns validation engine securing UAV swarms & satellite C2."
	@echo -e ""
	@echo -e "$(YELLOW)Core Build & Test Commands:$(RESET)"
	@echo -e "  $(GREEN)make build$(RESET)        Compile release targets (-O3 -march=native)"
	@echo -e "  $(GREEN)make debug$(RESET)        Compile debug targets with sanitizers (-fsanitize=address)"
	@echo -e "  $(GREEN)make test$(RESET)         Run all unit and plugin ABI tests via ctest"
	@echo -e "  $(GREEN)make bench$(RESET)        Execute hardware latency benchmark (< 120 ns SLA)"
	@echo -e "  $(GREEN)make install$(RESET)      Install libraries, CLI, and plugins system-wide (requires sudo)"
	@echo -e ""
	@echo -e "$(YELLOW)Ecosystem Synchronization:$(RESET)"
	@echo -e "  $(GREEN)make sync-matrix$(RESET)  Deploy libccsds_guard.so to sentinel-matrix shared deps"
	@echo -e "  $(GREEN)make sync-web$(RESET)     Sync base web app and mountpoint from sentinel-nexus"
	@echo -e "  $(GREEN)make sync-all$(RESET)     Full synchronization (build + install + sync-matrix + sync-web)"
	@echo -e ""
	@echo -e "$(YELLOW)Digital Twin Simulation Mesh:$(RESET)"
	@echo -e "  $(GREEN)make sim-up$(RESET)       Deploy the Autonomous UAV Swarm Tactical Defense Twin"
	@echo -e "  $(GREEN)make sim-down$(RESET)     Teardown the Swarm simulation mesh and release subnets"
	@echo -e "  $(GREEN)make sim-status$(RESET)   Display active swarm containers, subnets, and ports"
	@echo -e "  $(GREEN)make sim-logs$(RESET)     Stream real-time telecommand logs from UAV Flight Controller"
	@echo -e ""
	@echo -e "$(YELLOW)Clean & Housekeeping:$(RESET)"
	@echo -e "  $(GREEN)make clean$(RESET)        Remove build artifacts"
	@echo -e "  $(GREEN)make distclean$(RESET)    Full wipe of build, caches, and dangling matrix networks"
	@echo -e "$(CYAN)================================================================================$(RESET)"

# ==============================================================================
# 2. BUILD TARGETS
# ==============================================================================
.PHONY: all build debug
all: build

build:
	@echo -e "$(CYAN)[+] Configuring & Building Release Targets (Jobs: $(JOBS))...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@cd $(BUILD_DIR) && cmake .. -DCMAKE_BUILD_TYPE=Release
	@$(MAKE) -C $(BUILD_DIR) -j$(JOBS)
	@echo -e "$(GREEN)[+] Build Complete: libccsds_guard.so, ccsds_guard_dissector_plugin.so, aryo-aerospace.$(RESET)"

debug:
	@echo -e "$(YELLOW)[+] Configuring Debug Build with Address & UB Sanitizers...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@cd $(BUILD_DIR) && cmake .. -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"
	@$(MAKE) -C $(BUILD_DIR) -j$(JOBS)
	@echo -e "$(GREEN)[+] Debug Build Complete.$(RESET)"

# ==============================================================================
# 3. VERIFICATION & BENCHMARKS
# ==============================================================================
.PHONY: test bench
test: build
	@echo -e "$(CYAN)[+] Running ccsds-guard Test Suite...$(RESET)"
	@cd $(BUILD_DIR) && ctest --output-on-failure
	@echo -e "$(GREEN)[+] All Unit & Plugin ABI Tests Passed (100%).$(RESET)"

bench: build
	@echo -e "$(CYAN)[+] Executing Cycle-Accurate Hardware Latency Benchmark (< 120 ns SLA Invariant)...$(RESET)"
	@$(BUILD_DIR)/bench_latency

# ==============================================================================
# 4. INSTALLATION & DEPLOYMENT
# ==============================================================================
.PHONY: install sync-matrix sync-web sync-all
install: build
	@echo -e "$(CYAN)[+] Installing ccsds-guard System-Wide...$(RESET)"
	@sudo $(MAKE) -C $(BUILD_DIR) install
	@sudo ldconfig
	@mkdir -p $(SCENARIOS_DIR)/plugins
	@cp $(BUILD_DIR)/ccsds_guard_dissector_plugin.so $(SCENARIOS_DIR)/plugins/
	@echo -e "$(GREEN)[+] Installed /usr/local/lib/libccsds_guard.so, /usr/local/bin/aryo-aerospace.$(RESET)"

sync-matrix: build
	@echo -e "$(CYAN)[+] Syncing shared libraries to sentinel-matrix...$(RESET)"
	@mkdir -p $(MATRIX_DIR)/shared/lib
	@cp $(BUILD_DIR)/libccsds_guard.so $(MATRIX_DIR)/shared/lib/
	@echo -e "$(GREEN)[+] Synced libccsds_guard.so -> $(MATRIX_DIR)/shared/lib/$(RESET)"

sync-web:
	@echo -e "$(CYAN)[+] Synchronizing base dashboard from sentinel-nexus to sentinel-matrix...$(RESET)"
	@mkdir -p $(MATRIX_DIR)/web/plugins
	@if [ -d "$(NEXUS_DIR)/web" ]; then \
		cp -r $(NEXUS_DIR)/web/* $(MATRIX_DIR)/web/ 2>/dev/null || true; \
		mkdir -p $(MATRIX_DIR)/web/plugins; \
		echo -e "$(GREEN)[+] Base Web Dashboard Synced & Plugins Mountpoint Initialized.$(RESET)"; \
	else \
		echo -e "$(YELLOW)[!] Warning: $(NEXUS_DIR)/web not found. Skipping web sync.$(RESET)"; \
	fi

sync-all: install sync-matrix sync-web
	@echo -e "$(GREEN)[+] Full Ecosystem Synchronization Complete.$(RESET)"

# ==============================================================================
# 5. DIGITAL TWIN SIMULATION ORCHESTRATION
# ==============================================================================
.PHONY: sim sim-up sim-down sim-status sim-logs
sim: sim-up

sim-up: sync-all
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@echo -e "$(WHITE)  LAUNCHING AUTONOMOUS UAV SWARM TACTICAL DEFENSE DIGITAL TWIN                  $(RESET)"
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@aryo aerospace sim-swarm
	@echo -e "$(GREEN)[+] Mission Control Web Console: http://localhost:9443/$(RESET)"

sim-down:
	@echo -e "$(YELLOW)[+] Tearing down Swarm Simulation Mesh & Releasing Subnets...$(RESET)"
	@aryo aerospace sim-swarm-down || true
	@docker network prune -f >/dev/null 2>&1 || true
	@echo -e "$(GREEN)[+] Simulation Mesh Dismantled.$(RESET)"

sim-status:
	@echo -e "$(CYAN)[+] Active Tactical Swarm Simulation Containers:$(RESET)"
	@aryo aerospace sim-swarm-status

sim-logs:
	@echo -e "$(CYAN)[+] Tailing live telecommands from Protected UAV Alpha (Ctrl+C to exit)...$(RESET)"
	@docker logs -f matrix-uav-alpha

# ==============================================================================
# 6. CLEAN & HOUSEKEEPING
# ==============================================================================
.PHONY: clean distclean
clean:
	@echo -e "$(YELLOW)[+] Cleaning build directory...$(RESET)"
	@rm -rf $(BUILD_DIR)
	@echo -e "$(GREEN)[+] Clean complete.$(RESET)"

distclean: clean
	@echo -e "$(RED)[+] Performing deep cleanup (dismantling containers, caches, and dangling networks)...$(RESET)"
	@$(MAKE) sim-down >/dev/null 2>&1 || true
	@rm -rf $(MATRIX_DIR)/.matrix_cache/docker-compose.uav_swarm_tactical_defense.yml
	@echo -e "$(GREEN)[+] Deep clean complete.$(RESET)"