# admiral ⚓️  

**admiral** is an AWS-based Kubernetes homelab built entirely with **Infrastructure as Code (IaC)** using the **AWS Cloud Development Kit (CDK)**.  
It serves as a personal playground for experimenting with **cloud-native integrations**, **CI/CD pipelines**, and **event-driven infrastructure** — all while keeping everything reproducible and easy to spin up or tear down.  

---

## 🚀 Goals  

- **Homelab in the cloud** – Run a Kubernetes environment on AWS that mimics production-grade setups.  
- **All IaC, no clicks** – Every component is defined and deployed with AWS CDK.  
- **GitOps-friendly pipelines** – Use CDK Pipelines for CI/CD of infrastructure, with room for event-driven automation (e.g., custom AMIs/node group images).  
- **Cloud-native playground** – Integrate and test CNCF projects like Flux, ArgoCD, Prometheus, Linkerd, Istio, cert-manager, and more.  
- **Disposable & repeatable** – Spin clusters up, test ideas, and shut them down when not needed to save costs.  

---

## 🧰 What’s Inside  

- **AWS EKS (Elastic Kubernetes Service)** as the core cluster.  
- **CDK Pipelines** for deploying and updating the cluster and add-ons.  
- **Optional node groups** (Linux + Windows) for experimenting with hybrid workloads.  
- **CNCF ecosystem integrations** to explore observability, service mesh, GitOps, and storage.  
- **Event-driven automation** ideas:  
  - AMI builds for custom worker node images  
  - Auto-syncing add-ons and configs  
  - Notifications for cluster state changes  

---

## 📦 Roadmap  

- [ ] Bootstrap CDK Pipelines for multi-env deployment  
- [ ] Define EKS cluster and base node groups  
- [ ] Integrate GitOps (Flux/ArgoCD)  
- [ ] Add CNCF add-ons (Prometheus, cert-manager, etc.)  
- [ ] Experiment with service meshes (Linkerd, Istio)  
- [ ] Explore event-driven pipelines for image lifecycle management  
- [ ] Document homelab scenarios + experiments  

---

## ⚓ Why “Admiral”?  

Kubernetes comes from the Greek word for “helmsman.”  
If Kubernetes is the helmsman steering the ship, **admiral** is the admiral orchestrating the fleet of cloud-native experiments.  
