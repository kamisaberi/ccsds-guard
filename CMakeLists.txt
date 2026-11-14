# File: /home/kami/ccsds-guard/CMakeLists.txt

cmake_minimum_required(VERSION 3.20)
project(ccsds_guard VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# RPATH configuration: ensures binaries resolve /usr/local/lib ecosystem shared libraries
set(CMAKE_SKIP_BUILD_RPATH FALSE)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)
set(CMAKE_INSTALL_RPATH "/usr/local/lib")
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)

# Compiler performance flags
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(
        -O3
        -march=native
        -Wall
        -Wextra
        -Werror=return-type
        -fno-omit-frame-pointer
    )
endif()

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

# Core include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    /usr/local/include
)

# -----------------------------------------------------------------------------
# LINK SENTINEL ECOSYSTEM LIBRARIES
# -----------------------------------------------------------------------------
find_package(Threads REQUIRED)
find_library(BLACKBOX_LIB blackbox REQUIRED PATHS /usr/local/lib /usr/lib)
find_library(XINFER_LIB xinfer REQUIRED PATHS /usr/local/lib /usr/lib)

message(STATUS "[ccsds-guard] Linked Blackbox Essential: ${BLACKBOX_LIB}")
message(STATUS "[ccsds-guard] Linked Xinfer Essential:   ${XINFER_LIB}")

# Library sources
set(LIB_SOURCES
    src/core/tsc_clock.cpp
    src/ccsds/tc_frame.cpp
    src/ccsds/sec_frame.cpp
    src/stanag/stanag4586_dli.cpp
    src/defense/sliding_window.cpp
    src/defense/gps_spoof_detector.cpp
    src/defense/telemetry_desync.cpp
    src/defense/actuator_airgap.cpp
    src/pipeline/guard_engine.cpp
)

# Shared and Static Libraries
add_library(ccsds_guard SHARED ${LIB_SOURCES})
add_library(ccsds_guard_static STATIC ${LIB_SOURCES})
set_target_properties(ccsds_guard_static PROPERTIES OUTPUT_NAME ccsds_guard)

target_include_directories(ccsds_guard PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<BUILD_INTERFACE:/usr/local/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)
target_include_directories(ccsds_guard_static PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<BUILD_INTERFACE:/usr/local/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)

target_link_libraries(ccsds_guard PUBLIC
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
    Threads::Threads
)

target_link_libraries(ccsds_guard_static PUBLIC
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
    Threads::Threads
)

# Standalone CLI Tool
add_executable(ccsds-guard-ctl tools/ccsds_guard_ctl/main.cpp)
target_link_libraries(ccsds-guard-ctl PRIVATE
    ccsds_guard
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
)

# Extension Plugin for sentinel-stack CLI (aryo aerospace ...)
add_executable(aryo-aerospace tools/aryo_aerospace/main.cpp)
target_link_libraries(aryo-aerospace PRIVATE
    ccsds_guard
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
)

# Hardware Latency Benchmark (< 120 ns)
add_executable(bench_latency benchmarks/bench_latency.cpp)
target_link_libraries(bench_latency PRIVATE
    ccsds_guard
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
)

# Test Suite
enable_testing()
add_executable(test_replay tests/test_replay_window.cpp)
target_link_libraries(test_replay PRIVATE
    ccsds_guard
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
)
add_test(NAME TestReplay COMMAND test_replay)

add_executable(test_stanag tests/test_stanag_validation.cpp)
target_link_libraries(test_stanag PRIVATE
    ccsds_guard
    -Wl,--no-as-needed
    ${BLACKBOX_LIB}
    ${XINFER_LIB}
    -Wl,--as-needed
)
add_test(NAME TestStanag COMMAND test_stanag)

# Installation Rules
install(TARGETS ccsds_guard ccsds_guard_static ccsds-guard-ctl aryo-aerospace
    EXPORT CcsdsGuardTargets
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})

# CMake Package Export Config
set(CONFIG_INSTALL_DIR ${CMAKE_INSTALL_LIBDIR}/cmake/CcsdsGuard)
configure_package_config_file(
    cmake/CcsdsGuardConfig.cmake.in
    ${CMAKE_CURRENT_BINARY_DIR}/CcsdsGuardConfig.cmake
    INSTALL_DESTINATION ${CONFIG_INSTALL_DIR}
)
write_basic_package_version_file(
    ${CMAKE_CURRENT_BINARY_DIR}/CcsdsGuardConfigVersion.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY SameMajorVersion
)

install(FILES
    ${CMAKE_CURRENT_BINARY_DIR}/CcsdsGuardConfig.cmake
    ${CMAKE_CURRENT_BINARY_DIR}/CcsdsGuardConfigVersion.cmake
    DESTINATION ${CONFIG_INSTALL_DIR}
)
install(EXPORT CcsdsGuardTargets
    FILE CcsdsGuardTargets.cmake
    NAMESPACE CcsdsGuard::
    DESTINATION ${CONFIG_INSTALL_DIR}
)

# PkgConfig export
configure_file(
    cmake/ccsds_guard.pc.in
    ${CMAKE_CURRENT_BINARY_DIR}/ccsds_guard.pc
    @ONLY
)
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/ccsds_guard.pc
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/pkgconfig
)
