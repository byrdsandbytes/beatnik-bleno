#!/bin/bash

# ==============================================================================
# Beatnik Bleno - Verification & Setup Script
# ==============================================================================
# This script checks if the environment is correctly configured to run the
# Beatnik Bleno service. It verifies Node.js version, system dependencies,
# and Bluetooth hardware status.
#
# Usage: ./verify-setup.sh
# ==============================================================================

# --- Colors for logging ---
COLOR_RESET='\033[0m'
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[0;33m'
COLOR_CYAN='\033[0;36m'

# --- Helper functions for logging ---
log_info() {
  echo -e "${COLOR_CYAN}ℹ️  $1${COLOR_RESET}"
}

log_success() {
  echo -e "${COLOR_GREEN}✅ $1${COLOR_RESET}"
}

log_error() {
  echo -e "${COLOR_RED}🛑 $1${COLOR_RESET}"
}

log_warn() {
  echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_RESET}"
}

# --- Check functions ---

# 1. Check for NVM and correct Node.js version
check_node() {
  log_info "Checking Node.js version..."
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
  elif [ -s "$(brew --prefix nvm)/nvm.sh" ]; then
    source "$(brew --prefix nvm)/nvm.sh"
  else
    log_error "nvm is not found. Please install it from https://github.com/nvm-sh/nvm"
    exit 1
  fi

  if [ ! -f ".nvmrc" ]; then
    log_error ".nvmrc file not found. Cannot determine required Node.js version."
    exit 1
  fi

  required_version=$(cat .nvmrc)
  current_version=$(nvm current)

  if [ "$current_version" != "v$required_version" ]; then
    log_warn "Current Node.js version ($current_version) does not match required version (v$required_version)."
    log_info "Attempting to install Node.js v$required_version..."
    nvm install "$required_version"
    nvm use "$required_version"
    if [ $? -ne 0 ]; then
      log_error "Failed to install or use Node.js v$required_version. Please check your nvm setup."
      exit 1
    fi
  fi
  log_success "Node.js version is correct (v$required_version)."
}

# 2. Check for system dependencies (Debian/Ubuntu)
check_system_deps() {
  if [[ "$(uname)" != "Linux" ]]; then
    log_info "Skipping system dependency check on non-Linux OS."
    return
  fi

  log_info "Checking system dependencies (for Debian/Ubuntu)..."
  packages_to_check=("bluetooth" "bluez" "libbluetooth-dev" "libudev-dev")
  missing_packages=()

  for pkg in "${packages_to_check[@]}"; do
    if ! dpkg -s "$pkg" &> /dev/null; then
      missing_packages+=("$pkg")
    fi
  done

  if [ ${#missing_packages[@]} -ne 0 ]; then
    log_warn "Missing system dependencies: ${missing_packages[*]}"
    log_info "Please run the following command to install them:"
    echo "sudo apt-get update && sudo apt-get install -y ${missing_packages[*]}"
    exit 1
  fi
  log_success "All system dependencies are installed."
}

# 3. Check Bluetooth hardware status
check_bluetooth_status() {
  if [[ "$(uname)" != "Linux" ]]; then
    log_info "Skipping Bluetooth status check on non-Linux OS."
    return
  fi

  log_info "Checking Bluetooth hardware status..."

  # Check for RF-kill
  if command -v rfkill &> /dev/null && rfkill list bluetooth | grep -q "Soft blocked: yes"; then
    log_warn "Bluetooth is soft-blocked by rfkill."
    log_info "Attempting to unblock with 'sudo rfkill unblock bluetooth'..."
    sudo rfkill unblock bluetooth
    if [ $? -ne 0 ]; then
      log_error "Failed to unblock Bluetooth. Please run 'sudo rfkill unblock bluetooth' manually."
      exit 1
    fi
    log_success "Bluetooth unblocked successfully."
  fi

  # Check hciconfig status
  if ! command -v hciconfig &> /dev/null; then
      log_warn "hciconfig not found. Cannot check Bluetooth interface status."
      return
  fi

  if hciconfig | grep -q "hci0" && hciconfig hci0 | grep -q "DOWN"; then
    log_warn "Bluetooth interface hci0 is DOWN."
    log_info "Attempting to bring it up with 'sudo hciconfig hci0 up'..."
    sudo hciconfig hci0 up
    if [ $? -ne 0 ]; then
      log_error "Failed to bring up hci0. Please run 'sudo hciconfig hci0 up' manually."
      exit 1
    fi
    log_success "Bluetooth interface hci0 is now UP."
  fi

  log_success "Bluetooth hardware appears to be ready."
}

# 4. Install npm dependencies
install_npm_deps() {
  log_info "Installing npm dependencies..."
  npm install
  if [ $? -ne 0 ]; then
    log_error "npm install failed. Please check for errors."
    exit 1
  fi
  log_success "npm dependencies are up to date."
}

# 5. Build the project
build_project() {
  log_info "Building TypeScript project..."
  npm run build
  if [ $? -ne 0 ]; then
    log_error "TypeScript build failed. Please check for errors."
    exit 1
  fi
  log_success "Project built successfully."
}


# --- Main script execution ---
main() {
  echo -e "${COLOR_GREEN}=====================================${COLOR_RESET}"
  echo -e "${COLOR_GREEN}  Beatnik Bleno Verification Script  ${COLOR_RESET}"
  echo -e "${COLOR_GREEN}=====================================${COLOR_RESET}"
  
  check_node
  check_system_deps
  check_bluetooth_status
  install_npm_deps
  build_project

  echo -e "\n${COLOR_GREEN}=====================================${COLOR_RESET}"
  log_success "All checks passed! Your environment is ready."
  log_info "You can now start the service with:"
  echo -e "${COLOR_YELLOW}npm run start${COLOR_RESET}"
  echo -e "${COLOR_GREEN}=====================================${COLOR_RESET}"
}

main
