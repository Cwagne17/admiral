# Admiral Product Overview

Admiral is a reproducible AWS homelab centered on EKS (Elastic Kubernetes Service) with multi-tool integration. It serves as a personal playground for experimenting with cloud-native integrations, CI/CD pipelines, and event-driven infrastructure.

## Core Purpose

- **Homelab in the cloud** – Run a Kubernetes environment on AWS that mimics production-grade setups
- **All IaC, no clicks** – Every component is defined and deployed with AWS CDK
- **GitOps-friendly pipelines** – Use CDK Pipelines for CI/CD of infrastructure
- **Cloud-native playground** – Integrate and test CNCF projects like Flux, ArgoCD, Prometheus, Linkerd, Istio, cert-manager
- **Disposable & repeatable** – Spin clusters up, test ideas, and shut them down when not needed to save costs

## Key Features

- AWS EKS as the core cluster
- CDK Pipelines for deploying and updating clusters and add-ons
- Optional node groups (Linux + Windows) for hybrid workloads
- CNCF ecosystem integrations for observability, service mesh, GitOps, and storage
- Event-driven automation capabilities
- Cost control mechanisms with auto-shutdown and budget alerts

## Target Use Cases

- Learning and experimenting with Kubernetes and cloud-native technologies
- Testing infrastructure patterns and configurations
- Prototyping CI/CD pipelines and GitOps workflows
- Evaluating CNCF tools and service meshes
- Developing event-driven automation solutions
