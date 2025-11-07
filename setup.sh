#!/bin/bash

# ==============================================================================
# Beatnik Bleno - Full Setup & Installation Script
# ==============================================================================
# This script automates the entire setup process for the Beatnik Bleno service.
# It installs dependencies, configures the environment, and builds the project.
#
# Usage: ./setup.sh
# ==============================================================================

# --- Stop on first error ---
set -e

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
  exit 1
}

log_warn() {
  echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_RESET}"
}

# --- Setup functions ---

# 1. Install and set up NVM and Node.js
setup_node() {
  log_info "Setting up Node.js environment..."

  # Install nvm if not found
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    log_warn "nvm not found. Attempting to install..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    log_success "nvm installed. You may need to restart your terminal for it to be available everywhere."
  fi
  
  # Source nvm
  source "$NVM_DIR/nvm.sh"

  if [ ! -f ".nvmrc" ]; then
    log_error ".nvmrc file not found. Cannot determine required Node.js version."
  fi

  required_version=$(cat .nvmrc)
  log_info "Required Node.js version: v$required_version"
  
  nvm install "$required_version"
  nvm use "$required_version"
  
  log_success "Node.js setup complete (v$required_version)."
}

# 2. Install system dependencies (Debian/Ubuntu)
setup_system_deps() {
  if [[ "$(uname)" != "Linux" ]]; then
    log_info "Skipping system dependency installation on non-Linux OS."
    return
  fi

  log_info "Installing system dependencies (for Debian/Ubuntu)..."
  
  # Check for sudo
  if ! command -v sudo &> /dev/null; then
      log_error "sudo command not found. Please run this script as a user with sudo privileges."
  fi

  sudo apt-get update
  sudo apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev
  
  log_success "System dependencies installed."
}

# 3. Configure and enable Bluetooth hardware
setup_bluetooth() {
  if [[ "$(uname)" != "Linux" ]]; then
    log_info "Skipping Bluetooth setup on non-Linux OS."
    return
  fi

  log_info "Configuring Bluetooth hardware..."

  # Enable and start the Bluetooth service
  sudo systemctl enable bluetooth
  sudo systemctl start bluetooth

  # Unblock Bluetooth via rfkill
  if command -v rfkill &> /dev/null; then
    sudo rfkill unblock bluetooth
  fi

  # Bring the hci0 interface up
  if command -v hciconfig &> /dev/null; then
    sudo hciconfig hci0 up
  fi

  log_success "Bluetooth hardware configured and enabled."
}

# 4. Grant Node permissions for BLE without sudo
grant_node_permissions() {
    if [[ "$(uname)" != "Linux" ]]; then
        log_info "Skipping Node.js capability setup on non-Linux OS."
        return
    fi

    log_info "Granting Node.js network capabilities to avoid using sudo..."
    
    # Get the full path to the node executable being used by nvm
    node_path=$(nvm_find_node_version "$(nvm current)")/bin/node
    
    if [ -z "$node_path" ]; then
        log_error "Could not find the path for the current Node.js executable."
    fi

    sudo setcap cap_net_raw+eip "$node_path"
    log_success "Node.js capabilities set on $node_path"
}


# --- Main script execution ---
main() {
  echo -e "${COLOR_GREEN}=====================================${COLOR_RESET}"
  echo -e "${COLOR_GREEN}   Beatnik Bleno Full Setup Script   ${COLOR_RESET}"
  echo -e "${COLOR_GREEN}=====================================${COLOR_RESET}"
  
  setup_node
  setup_system_deps
  setup_bluetooth
  
  log_info "Installing npm dependencies..."
  npm install
  log_success "npm dependencies installed."

  log_info "Building TypeScript project..."
  npm run build
  log_success "Project built successfully."

  grant_node_permissions

  echo -e "\n${COLOR_GREEN}=====================================${COLOR_RESET}"
  log_success "Setup complete! Your environment is ready."
  log_info "You can now start the service with:"
  echo -e "${COLOR_YELLOW}npm run start${COLOR_RESET}"
  echo -e "${COLOR_GREEN}=====================================${COLOR_RESET}"
}

main
