---
inclusion: always
---

# Admiral Product Overview

Admiral is a reproducible AWS homelab centered on EKS (Elastic Kubernetes Service) with multi-tool integration. It serves as a personal playground for experimenting with cloud-native integrations, CI/CD pipelines, and event-driven infrastructure.

## Core Purpose

Admiral is a **disposable, repeatable AWS homelab** for cloud-native experimentation:

- **Homelab in the cloud**: Production-grade Kubernetes environment on AWS
- **All IaC, no clicks**: Every component defined and deployed with AWS CDK
- **GitOps-friendly**: CDK Pipelines for CI/CD of infrastructure
- **Cloud-native playground**: Test CNCF projects (Flux, ArgoCD, Prometheus, Linkerd, Istio, cert-manager)
- **Cost-optimized**: Spin up, test, shut down to save costs

## Key Features

- **AWS EKS**: Core Kubernetes cluster
- **CDK Pipelines**: Infrastructure CI/CD
- **Hybrid workloads**: Optional Linux + Windows node groups
- **CNCF integrations**: Observability, service mesh, GitOps, storage
- **Event-driven automation**: Automated workflows and responses
- **Cost controls**: Auto-shutdown and budget alerts

## Target Use Cases

- Kubernetes and cloud-native technology experimentation
- Infrastructure pattern and configuration testing
- CI/CD pipeline and GitOps workflow prototyping
- CNCF tool and service mesh evaluation
- Event-driven automation solution development

## Project Context for AI Assistant

When working with Admiral:

- Focus on **reproducible, cost-effective** solutions
- Prioritize **infrastructure as code** over manual configuration
- Consider **multi-environment** deployment patterns (dev/stage/prod)
- Emphasize **security best practices** and **least privilege**
- Design for **disposability** - resources should be easily created/destroyed
