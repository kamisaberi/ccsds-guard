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
PROJECT_DIR   := $(shell pwd)
BUILD_DIR     := $(PROJECT_DIR)/build
SCENARIOS_DIR := $(PROJECT_DIR)/scenarios/tactical_uav_swarm_combat_grid
MATRIX_DIR    := /home/kami/sentinel-matrix
NEXUS_DIR     := /home/kami/sentinel-nexus
ETC_HARNESSES := /etc/sentinel/lab/harnesses
OPT_HARNESSES := /opt/sentinel-stack/harnesses
JOBS          ?= $(shell nproc)

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
	@echo -e "$(YELLOW)System Initialization:$(RESET)"
	@echo -e "  $(GREEN)make init$(RESET)         Hard copy all research harnesses to /etc and /opt (NO links)"
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
	@echo -e "  $(GREEN)make sync-all$(RESET)     Full synchronization (build + install + init + sync-matrix)"
	@echo -e ""
	@echo -e "$(YELLOW)Digital Twin Simulation Mesh:$(RESET)"
	@echo -e "  $(GREEN)make combat-up$(RESET)    Deploy 6-container multi-UAV combat grid (3 Sentries)"
	@echo -e "  $(GREEN)make combat-down$(RESET)  Teardown combat grid and release subnets"
	@echo -e "  $(GREEN)make combat-status$(RESET)Display running swarm containers and ports"
	@echo -e "  $(GREEN)make combat-logs$(RESET)  Stream live telecommand logs from UAV Alpha Leader"
	@echo -e ""
	@echo -e "$(YELLOW)Clean & Housekeeping:$(RESET)"
	@echo -e "  $(GREEN)make clean$(RESET)        Remove build artifacts"
	@echo -e "  $(GREEN)make distclean$(RESET)    Full wipe of build, caches, and dangling matrix networks"
	@echo -e "$(CYAN)================================================================================$(RESET)"

# ==============================================================================
# 2. SYSTEM INITIALIZATION (HARD COPIES - ZERO SYMLINKS)
# ==============================================================================
.PHONY: init
init:
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@echo -e "$(WHITE)  INITIALIZING PERMANENT SYSTEM HARNESSES (HARD COPY - NO SYMLINKS)            $(RESET)"
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@sudo mkdir -p $(ETC_HARNESSES)
	@sudo mkdir -p $(OPT_HARNESSES)
	@chmod +x harnesses/*.py 2>/dev/null || true
	@echo -e "$(CYAN)[+] Hard-copying research harnesses to $(ETC_HARNESSES) and $(OPT_HARNESSES)...$(RESET)"
	@for f in harnesses/*.py; do \
		if [ -f "$$f" ]; then \
			base=$$(basename $$f); \
			hyphen_base=$$(echo $$base | tr '_' '-'); \
			sudo rm -f $(ETC_HARNESSES)/$$base $(ETC_HARNESSES)/$$hyphen_base; \
			sudo cp -f $$f $(ETC_HARNESSES)/$$base; \
			sudo cp -f $$f $(ETC_HARNESSES)/$$hyphen_base; \
			sudo rm -f $(OPT_HARNESSES)/$$base $(OPT_HARNESSES)/$$hyphen_base; \
			sudo cp -f $$f $(OPT_HARNESSES)/$$base; \
			sudo cp -f $$f $(OPT_HARNESSES)/$$hyphen_base; \
		fi \
	done
	@sudo chmod 755 $(ETC_HARNESSES)/*.py
	@sudo chmod 755 $(OPT_HARNESSES)/*.py
	@# Verify that zero symbolic links exist in the destination
	@for dest in $(ETC_HARNESSES)/*.py $(OPT_HARNESSES)/*.py; do \
		if [ -L "$$dest" ]; then \
			echo -e "$(RED)[-] Error: $$dest is a symlink! Aborting.$(RESET)"; \
			exit 1; \
		fi \
	done
	@echo -e "$(GREEN)[+] Verification: All harnesses are permanent physical files (0 symlinks).$(RESET)"
	@echo -e "$(GREEN)[+] Production directories initialized with 0755 root permissions:$(RESET)"
	@echo -e "    • $(ETC_HARNESSES)"
	@echo -e "    • $(OPT_HARNESSES)"
	@echo -e "$(CYAN)================================================================================$(RESET)"

# ==============================================================================
# 3. BUILD TARGETS
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
# 4. VERIFICATION & BENCHMARKS
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
# 5. INSTALLATION & DEPLOYMENT
# ==============================================================================
.PHONY: install sync-matrix sync-web sync-all
install: build init
	@echo -e "$(CYAN)[+] Installing ccsds-guard System-Wide...$(RESET)"
	@sudo $(MAKE) -C $(BUILD_DIR) install
	@sudo ldconfig
	@echo -e "$(GREEN)[+] Installed /usr/local/lib/libccsds_guard.so, /usr/local/lib/blackbox/ccsds_guard_dissector_plugin.so, /usr/local/bin/aryo-aerospace.$(RESET)"

	
sync-matrix: build
	@echo -e "$(CYAN)[+] Syncing shared libraries to sentinel-matrix...$(RESET)"
	@mkdir -p $(MATRIX_DIR)/shared/lib
	@cp -f $(BUILD_DIR)/libccsds_guard.so $(MATRIX_DIR)/shared/lib/
	@echo -e "$(GREEN)[+] Synced libccsds_guard.so -> $(MATRIX_DIR)/shared/lib/$(RESET)"

sync-web:
	@echo -e "$(CYAN)[+] Synchronizing base dashboard from sentinel-nexus to sentinel-matrix...$(RESET)"
	@mkdir -p $(MATRIX_DIR)/web/plugins
	@if [ -d "$(NEXUS_DIR)/web" ]; then \
		cp -r $(NEXUS_DIR)/web/* $(MATRIX_DIR)/web/ 2>/dev/null || true; \
		mkdir -p $(MATRIX_DIR)/web/plugins; \
		echo -e "$(GREEN)[+] Base Web Dashboard Synced & Plugins Mountpoint Initialized.$(RESET)"; \
	fi

sync-all: install sync-matrix sync-web
	@echo -e "$(GREEN)[+] Full Ecosystem Synchronization Complete.$(RESET)"

# ==============================================================================
# 6. DIGITAL TWIN SIMULATION ORCHESTRATION (3-NODE COMBAT GRID)
# ==============================================================================
.PHONY: combat-up combat-down combat-status combat-logs
combat-up: sync-all
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@echo -e "$(WHITE)  LAUNCHING 6-CONTAINER MULTI-UAV COMBAT GRID (3 EDGE APPLIANCES)               $(RESET)"
	@echo -e "$(CYAN)================================================================================$(RESET)"
	@aryo aerospace sim-combat-grid
	@echo -e "$(GREEN)[+] Swarm Combat Grid Live: http://localhost:9443/$(RESET)"

combat-down:
	@echo -e "$(YELLOW)[+] Tearing down Swarm Combat Grid...$(RESET)"
	@aryo aerospace sim-combat-grid-down || true
	@docker network prune -f >/dev/null 2>&1 || true
	@echo -e "$(GREEN)[+] Swarm Combat Grid Dismantled.$(RESET)"

combat-status:
	@docker ps --filter "name=matrix-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

combat-logs:
	@docker logs -f matrix-uav-alpha

# ==============================================================================
# 7. CLEAN & HOUSEKEEPING
# ==============================================================================
.PHONY: clean distclean
clean:
	@echo -e "$(YELLOW)[+] Cleaning build directory...$(RESET)"
	@rm -rf $(BUILD_DIR)
	@echo -e "$(GREEN)[+] Clean complete.$(RESET)"

distclean: clean
	@echo -e "$(RED)[+] Performing deep cleanup (dismantling containers, caches, and dangling networks)...$(RESET)"
	@$(MAKE) combat-down >/dev/null 2>&1 || true
	@rm -rf $(MATRIX_DIR)/.matrix_cache/docker-compose.tactical_uav_swarm_combat_grid.yml
	@echo -e "$(GREEN)[+] Deep clean complete.$(RESET)"