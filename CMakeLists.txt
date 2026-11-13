# File: /home/kami/ccsds-guard/CMakeLists.txt

cmake_minimum_required(VERSION 3.20)
project(ccsds_guard VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if (CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
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

include_directories(include)

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

add_library(ccsds_guard SHARED ${LIB_SOURCES})
add_library(ccsds_guard_static STATIC ${LIB_SOURCES})
set_target_properties(ccsds_guard_static PROPERTIES OUTPUT_NAME ccsds_guard)

target_include_directories(ccsds_guard PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)
target_include_directories(ccsds_guard_static PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)

find_package(Threads REQUIRED)
target_link_libraries(ccsds_guard PUBLIC Threads::Threads)
target_link_libraries(ccsds_guard_static PUBLIC Threads::Threads)

# CLI Tool
add_executable(ccsds-guard-ctl tools/ccsds_guard_ctl/main.cpp)
target_link_libraries(ccsds-guard-ctl PRIVATE ccsds_guard)

# Latency Benchmark
add_executable(bench_latency benchmarks/bench_latency.cpp)
target_link_libraries(bench_latency PRIVATE ccsds_guard)

# Tests
enable_testing()
add_executable(test_replay tests/test_replay_window.cpp)
target_link_libraries(test_replay PRIVATE ccsds_guard)
add_test(NAME TestReplay COMMAND test_replay)

add_executable(test_stanag tests/test_stanag_validation.cpp)
target_link_libraries(test_stanag PRIVATE ccsds_guard)
add_test(NAME TestStanag COMMAND test_stanag)

# Installation Rules
install(TARGETS ccsds_guard ccsds_guard_static ccsds-guard-ctl
    EXPORT CcsdsGuardTargets
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})

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

configure_file(
    cmake/ccsds_guard.pc.in
    ${CMAKE_CURRENT_BINARY_DIR}/ccsds_guard.pc
    @ONLY
)
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/ccsds_guard.pc
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/pkgconfig
)