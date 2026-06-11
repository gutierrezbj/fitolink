# Deploy rápido vía GHCR — sacar el build del VPS

**Problema que resuelve:** antes cada deploy compilaba el frontend (Vite) **dentro
del VPS** → ~30 min y la CPU al límite (avisos de Hostinger). Ahora GitHub Actions
compila las imágenes en sus runners (gratis, potentes) y las publica a GHCR; el VPS
solo hace `pull`. **Deploy de ~30 min → segundos.**

```
push a main ──► GitHub Actions compila web/api/geo ──► publica a ghcr.io
                                                              │
            VPS:  docker compose pull + up -d  ◄──────────────┘   (sin compilar)
```

---

## Setup — UNA SOLA VEZ

### 1. Confirmar que el workflow construyó las imágenes

Tras el primer push con `.github/workflows/deploy.yml`:
- Ve a **GitHub → repo → pestaña Actions** → el workflow "Build & push images to GHCR" debe salir en **verde** (~3-5 min la primera vez).
- Luego **repo → Packages** (lateral derecho del repo o perfil) → deben aparecer 3 paquetes:
  `fitolink-web`, `fitolink-api`, `fitolink-geo`.

### 2. Dar acceso de lectura al VPS (las imágenes son privadas)

a. **Crear un PAT** en GitHub: Settings → Developer settings → Personal access tokens
   → **Tokens (classic)** → Generate new token → marca solo el scope **`read:packages`**.
   Cópialo (empieza por `ghp_…`).

b. **En el VPS**, autenticar Docker contra GHCR **sin escribir el token en la línea
   de comando** (lo lee por stdin para no exponerlo):

   ```bash
   # pega el PAT cuando lo pida (no queda en el historial)
   read -s GHCR_PAT
   echo "$GHCR_PAT" | docker login ghcr.io -u gutierrezbj --password-stdin
   unset GHCR_PAT
   ```

   Debe responder `Login Succeeded`. Esto se guarda en `~/.docker/config.json` del
   VPS y no hay que repetirlo.

---

## Deploy de cada día (desde tu máquina)

```bash
# 1) push → dispara el build en GitHub Actions
cd /Users/juanguti/dev/srs/fitolink && git push origin main

# 2) ESPERA a que el workflow termine en verde (pestaña Actions, ~3-5 min)
#    — si el VPS hace pull antes de que termine, baja la imagen vieja.

# 3) en el VPS: bajar imágenes nuevas y levantar (segundos)
ssh root@100.110.52.22 "cd /opt/fitolink && bash deploy-ghcr.sh"
```

El pipeline geo (cuando haga falta regenerar datos) se corre aparte:

```bash
ssh root@100.110.52.22 "cd /opt/fitolink && docker compose -f docker-compose.prod.yml run --rm geo-pipeline"
```

---

## Rollback (si GHCR fallara)

El bloque `build:` sigue en `docker-compose.prod.yml`, así que el flujo viejo
siempre está disponible:

```bash
ssh root@100.110.52.22 "cd /opt/fitolink && docker compose -f docker-compose.prod.yml up -d --build"
```

Esto vuelve a compilar en el VPS (lento, pero funciona) sin depender de GHCR.

---

## Notas

- **Orden importa:** el `git push` dispara el build; el `pull` del VPS debe ir
  DESPUÉS de que Actions termine en verde, o bajará la imagen anterior.
- Las imágenes llevan tag `:latest` y `:<sha>`. El compose usa `:latest`.
- `VITE_SHOW_DEMO=true` y `VITE_API_URL=` (vacío) se fijan como build-args en el
  workflow; el proxy nginx del VPS enruta `/api` en runtime.
- El primer build en Actions es completo; los siguientes usan cache (`type=gha`)
  y son más rápidos.
