#!/bin/bash

# Admiral Homelab CDK Bootstrap Script
# This script bootstraps CDK for all environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to bootstrap a single environment
bootstrap_environment() {
    local env=$1
    local config_file="config/environments/${env}.json"
    
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        return 1
    fi
    
    print_status "Loading configuration for environment: $env"
    
    # Extract account and region from config file
    local account=$(jq -r '.account' "$config_file")
    local region=$(jq -r '.region' "$config_file")
    
    if [[ "$account" == "null" || "$region" == "null" ]]; then
        print_error "Invalid configuration: account or region not found in $config_file"
        return 1
    fi
    
    print_status "Bootstrapping CDK for environment: $env (Account: $account, Region: $region)"
    
    # Bootstrap CDK
    npx cdk bootstrap \
        --context env="$env" \
        aws://"$account"/"$region" \
        --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
        --trust-account-for-lookup "$account" \
        --verbose
    
    if [[ $? -eq 0 ]]; then
        print_status "Successfully bootstrapped environment: $env"
    else
        print_error "Failed to bootstrap environment: $env"
        return 1
    fi
}

# Main script
main() {
    print_status "Admiral Homelab CDK Bootstrap"
    print_status "=============================="
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
    
    # Check if CDK is available
    if ! command -v npx &> /dev/null; then
        print_error "npx is required but not installed. Please install Node.js and npm first."
        exit 1
    fi
    
    # If specific environment is provided as argument
    if [[ $# -eq 1 ]]; then
        bootstrap_environment "$1"
        exit $?
    fi
    
    # Bootstrap all environments
    print_status "Bootstrapping all environments..."
    
    local environments=("dev" "stage" "prod")
    local failed_envs=()
    
    for env in "${environments[@]}"; do
        if bootstrap_environment "$env"; then
            print_status "✓ $env bootstrapped successfully"
        else
            print_error "✗ $env bootstrap failed"
            failed_envs+=("$env")
        fi
        echo
    done
    
    # Summary
    if [[ ${#failed_envs[@]} -eq 0 ]]; then
        print_status "All environments bootstrapped successfully!"
    else
        print_error "Failed to bootstrap environments: ${failed_envs[*]}"
        exit 1
    fi
}

# Show usage if help is requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [environment]"
    echo ""
    echo "Bootstrap CDK for Admiral homelab environments"
    echo ""
    echo "Arguments:"
    echo "  environment    Optional. Specific environment to bootstrap (dev, stage, prod)"
    echo "                 If not provided, all environments will be bootstrapped"
    echo ""
    echo "Examples:"
    echo "  $0           # Bootstrap all environments"
    echo "  $0 dev       # Bootstrap only dev environment"
    echo ""
    exit 0
fi

# Run main function
main "$@"