#!/bin/bash

# Admiral Homelab Kubeconfig Management Script
# This script updates kubeconfig for EKS clusters

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

# Function to update kubeconfig for a specific environment
update_kubeconfig() {
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
    local cluster_name="admiral-${env}-cluster"
    
    if [[ "$account" == "null" || "$region" == "null" ]]; then
        print_error "Invalid configuration: account or region not found in $config_file"
        return 1
    fi
    
    print_status "Updating kubeconfig for cluster: $cluster_name (Region: $region)"
    
    # Update kubeconfig
    aws eks update-kubeconfig \
        --region "$region" \
        --name "$cluster_name" \
        --alias "admiral-${env}"
    
    if [[ $? -eq 0 ]]; then
        print_status "Successfully updated kubeconfig for environment: $env"
        print_status "You can now use: kubectl --context admiral-${env} get nodes"
    else
        print_error "Failed to update kubeconfig for environment: $env"
        return 1
    fi
}

# Function to list available contexts
list_contexts() {
    print_status "Available kubectl contexts:"
    kubectl config get-contexts | grep -E "(admiral-|CURRENT)"
}

# Function to switch context
switch_context() {
    local env=$1
    local context="admiral-${env}"
    
    print_status "Switching to context: $context"
    kubectl config use-context "$context"
    
    if [[ $? -eq 0 ]]; then
        print_status "Successfully switched to context: $context"
        print_status "Current cluster info:"
        kubectl cluster-info
    else
        print_error "Failed to switch to context: $context"
        return 1
    fi
}

# Function to test cluster connectivity
test_cluster() {
    local env=$1
    local context="admiral-${env}"
    
    print_status "Testing connectivity to cluster: $context"
    
    kubectl --context "$context" get nodes
    
    if [[ $? -eq 0 ]]; then
        print_status "✓ Cluster connectivity test passed"
    else
        print_error "✗ Cluster connectivity test failed"
        return 1
    fi
}

# Main script
main() {
    local command=$1
    local env=$2
    
    case "$command" in
        "update")
            if [[ -z "$env" ]]; then
                print_error "Environment required for update command"
                echo "Usage: $0 update <environment>"
                exit 1
            fi
            update_kubeconfig "$env"
            ;;
        "list")
            list_contexts
            ;;
        "switch")
            if [[ -z "$env" ]]; then
                print_error "Environment required for switch command"
                echo "Usage: $0 switch <environment>"
                exit 1
            fi
            switch_context "$env"
            ;;
        "test")
            if [[ -z "$env" ]]; then
                print_error "Environment required for test command"
                echo "Usage: $0 test <environment>"
                exit 1
            fi
            test_cluster "$env"
            ;;
        *)
            # Default behavior for backward compatibility
            if [[ -n "$command" ]]; then
                update_kubeconfig "$command"
            else
                print_error "Command required"
                echo ""
                echo "Usage: $0 <command> [environment]"
                echo ""
                echo "Commands:"
                echo "  update <env>    Update kubeconfig for specified environment"
                echo "  list            List available kubectl contexts"
                echo "  switch <env>    Switch to specified environment context"
                echo "  test <env>      Test connectivity to specified environment"
                echo ""
                echo "Examples:"
                echo "  $0 update dev   # Update kubeconfig for dev environment"
                echo "  $0 list         # List all contexts"
                echo "  $0 switch dev   # Switch to dev context"
                echo "  $0 test dev     # Test dev cluster connectivity"
                echo ""
                exit 1
            fi
            ;;
    esac
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v aws &> /dev/null; then
        missing_deps+=("aws-cli")
    fi
    
    if ! command -v kubectl &> /dev/null; then
        missing_deps+=("kubectl")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again"
        exit 1
    fi
}

# Show usage if help is requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Admiral Homelab Kubeconfig Management"
    echo "====================================="
    echo ""
    echo "Usage: $0 <command> [environment]"
    echo ""
    echo "Commands:"
    echo "  update <env>    Update kubeconfig for specified environment"
    echo "  list            List available kubectl contexts"
    echo "  switch <env>    Switch to specified environment context"
    echo "  test <env>      Test connectivity to specified environment"
    echo ""
    echo "Environments: dev, stage, prod"
    echo ""
    echo "Examples:"
    echo "  $0 update dev   # Update kubeconfig for dev environment"
    echo "  $0 list         # List all contexts"
    echo "  $0 switch dev   # Switch to dev context"
    echo "  $0 test dev     # Test dev cluster connectivity"
    echo ""
    exit 0
fi

# Check dependencies before running
check_dependencies

# Run main function
main "$@"