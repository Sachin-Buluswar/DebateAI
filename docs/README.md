# 📚 DebateAI Documentation

Welcome to the DebateAI documentation! This guide will help you navigate through all available documentation.

## 🚀 Quick Links

- **[Getting Started](./getting-started/)** - Installation, setup, and first steps
- **[Architecture](./architecture/)** - System design and technical architecture
- **[Development](./development/)** - Developer guides and best practices
- **[Deployment](./deployment/)** - Production deployment and operations
- **[API Reference](./api/)** - API documentation and integration guides
- **[Project Info](./project/)** - Roadmap, status, and requirements

## 📖 Documentation Overview

### Getting Started
Perfect for new users and developers who want to quickly get up and running.

- **[Installation Guide](./getting-started/installation.md)** - System requirements and setup instructions
- **[Configuration](./getting-started/configuration.md)** - Environment variables and initial configuration
- **[Quick Start Tutorial](./getting-started/quick-start.md)** - Your first debate with DebateAI

### Architecture
Understand how DebateAI is built and how components interact.

- **[System Overview](./architecture/overview.md)** - High-level architecture and design principles
- **[Frontend Architecture](./architecture/frontend.md)** - Next.js app structure and UI components
- **[Backend Architecture](./architecture/backend.md)** - API design and service layer
- **[Database Design](./architecture/database.md)** - Supabase schema and RLS policies
- **[Enhanced RAG System](./architecture/enhanced-rag.md)** - PDF search and evidence management

### Development
Everything you need to contribute to DebateAI.

- **[Development Setup](./development/setup.md)** - Local development environment
- **[Git Workflow](./development/workflow.md)** - Branching strategy and contribution guidelines
- **[Code Patterns](./development/patterns.md)** - Best practices and code examples
- **[Testing Guide](./development/testing.md)** - Testing strategies and tools
- **[Troubleshooting](./development/troubleshooting.md)** - Common issues and solutions

### Deployment
Deploy and operate DebateAI in production.

- **[Docker Setup](./deployment/docker.md)** - Containerization and orchestration
- **[CI/CD Pipeline](./deployment/ci-cd.md)** - GitHub Actions and automated deployment
- **[Monitoring](./deployment/monitoring.md)** - Observability with OpenTelemetry and Sentry
- **[Security Guide](./deployment/security.md)** - Security best practices and audit findings
- **[Deployment Checklist](./deployment/checklist.md)** - Pre-deployment verification

### API Documentation
Detailed API references and integration guides.

- **[REST API](./api/rest.md)** - HTTP endpoints and usage examples
- **[WebSocket API](./api/websocket.md)** - Real-time communication with Socket.IO
- **Integration Guides**:
  - **[OpenAI](./api/integrations/openai.md)** - AI debate generation and analysis
  - **[ElevenLabs](./api/integrations/elevenlabs.md)** - Text-to-speech and speech-to-text
  - **[Supabase](./api/integrations/supabase.md)** - Database and authentication

### Project Information
Project management and planning documents.

- **[Current Status](./project/status.md)** - Production readiness and deployment blockers
- **[Development Roadmap](./project/roadmap.md)** - Feature roadmap and priorities
- **[Original Requirements](./project/requirements.md)** - Initial project specifications

## 🔍 Finding Information

### By Role

**👤 Users**
- Start with [Getting Started](./getting-started/)
- Check [Current Status](./project/status.md) for available features

**💻 Developers**
- Read [Development Setup](./development/setup.md)
- Review [Code Patterns](./development/patterns.md)
- Understand [Git Workflow](./development/workflow.md)

**🚀 DevOps/SRE**
- Focus on [Deployment](./deployment/)
- Review [Monitoring](./deployment/monitoring.md)
- Check [Security Guide](./deployment/security.md)

**🏗️ Architects**
- Study [Architecture](./architecture/)
- Review [System Overview](./architecture/overview.md)
- Understand [Database Design](./architecture/database.md)

### By Task

**Setting up locally?**
→ [Installation Guide](./getting-started/installation.md) → [Development Setup](./development/setup.md)

**Deploying to production?**
→ [Deployment Checklist](./deployment/checklist.md) → [Docker Setup](./deployment/docker.md)

**Adding a new feature?**
→ [Git Workflow](./development/workflow.md) → [Code Patterns](./development/patterns.md)

**Debugging an issue?**
→ [Troubleshooting](./development/troubleshooting.md) → [Monitoring](./deployment/monitoring.md)

## 📝 Documentation Standards

- All documentation uses Markdown format
- Code examples include language hints for syntax highlighting
- File paths are relative to project root unless specified
- Screenshots and diagrams are stored in `docs/assets/`
- Keep documentation up-to-date with code changes

## 🤝 Contributing to Docs

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on improving documentation.

---

**Last Updated**: July 17, 2025  
**Documentation Version**: 2.0