# System Rapid Solutions (SRS) — Company Context

## Company Profile
- **Name**: System Rapid Solutions (SRS)
- **CEO**: Juan Ramon Gutierrez Blanco (JuanCho)
- **Focus**: AI-augmented software development, drone operations, enterprise platforms
- **Operations**: Spain (HQ), LATAM, Europe, Middle East
- **Methodology**: SDD (Software Development with AI Direction)

## Active Projects (March 2026)

| Project | Offset | Phase | Description |
|---------|--------|-------|-------------|
| CRM SRS | +0 | In development | Commercial management CRM |
| OverWatch | +10 | Fase 1 complete | Copernicus + Drones post-disaster inspection |
| SA99 | +20 | Fase 0 complete | AI agent orchestrator with persistent memory |
| DroneHub SRS | +30 | Fase 1.5 in progress | Global drone ecosystem platform |
| **FitoLink** | **+40** | **✅ Deployed staging 2026-03-29** | **Agricultural intelligence + pilot marketplace** |
| SkyPro/DroneOps | +50 | Fase 0 in progress | Drone ops notification app (5G + DJI Cloud) |
| ContractBuilder | +60 | Fase 0 complete | AI document merger for immigration law firm |
| BodyForge | +70 | Fase 0 complete | Body transformation platform with AI |
| Kolmena | +80 | - | (Reserved) |
| MOEVE-T | +90 | Fase 0 in progress | EV charging experience platform (client: MOEVE) |
| Skypro360 OpsManager | +100 | Fase 0 complete | AESA-compliant UAS flight ops management (SaaS) |

## Infrastructure

| Server | IP Public | IP Tailscale | Role | Specs |
|--------|-----------|--------------|------|-------|
| VPS PROD | 72.62.41.234 | 100.71.174.77 | Production | 2 vCPU, 8GB RAM, 96GB SSD, Ubuntu 24.04 |
| VPS STAGING | 187.77.71.102 | 100.110.52.22 | Staging/QA | 1 vCPU, 4GB RAM, 50GB NVMe, Ubuntu 22.04 |
| Mac Mini (bleu) | 5.225.5.105 | 100.107.171.77 | Development | M4 Pro, 24GB RAM, macOS 26.3 |

**FitoLink ports (offset +40):** Web:3040, API:4040, Mongo:6040

**Total infra cost**: ~22.50 EUR/month (Hostinger VPS + backups + domains)

## Processes

| Process | Description |
|---------|-------------|
| SDD | Software Development with AI Direction — human directs, AI executes. 8 mandatory doc sections before code. |
| Kickoff Protocol | 8-phase launch standard. No phase skipped. |
| Port Convention | 3xxx front, 4xxx API, 5xxx internal, 6xxx DB. Offset per project. Always 127.0.0.1. |
| Deploy | Docker Compose multi-stage. `ssh root@100.110.52.22 "bash /opt/fitolink/deploy.sh"` — git pull + build + up + seed. Nginx + SSL via Certbot. Git conectado a GitHub (origin). |

## Pilot Certifications (JuanCho)
- EASA Remote Pilot Certificate: A1/A3 + A2 (AESA, Spain)
- UAS Operator Registration (EASA/AESA)
- Phytosanitary Professional License — Qualified Pilot Applicator (valid until Jan 2035)
- Fleet: DJI M30T, Mavic 3E, Mavic 3 Pro, Flip, RTK2 base station

## FitoLink Strategic Partners
- **Drovinci** — Network of certified applicator pilots, operational base
- **Agroxdron** — Equipment ecosystem, pilot training, acquisition channel
- **SRS** — Tech platform + active operator (certified pilot + thermographer)
