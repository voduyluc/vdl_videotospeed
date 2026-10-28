#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_user
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 22.04 && "$(uname -m)" == x86_64 ]] || { echo 'Supported: Ubuntu 22.04 x86_64'; exit 1; }
[[ "$ROOT" != *[[:space:]%]* ]] || { echo 'Clone into a path without whitespace or %'; exit 1; }
command -v nvidia-smi >/dev/null || { echo 'Install the NVIDIA driver for RTX 5060 and reboot first.'; exit 1; }
nvidia-smi
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y python3-venv python3-dev build-essential cmake git curl ffmpeg libsndfile1 libgomp1 pkg-config
if [[ "${1:-}" == --install-cuda-toolkit ]]; then
  temp="$(mktemp -d)"
  trap 'rm -rf -- "$temp"' EXIT
  curl --fail --location --retry 3 https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb -o "$temp/cuda-keyring.deb"
  "${SUDO[@]}" dpkg -i "$temp/cuda-keyring.deb"
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y cuda-toolkit-12-8
fi
if [[ ! -f .env ]]; then
  cp .env.example .env
  password="$(openssl rand -hex 20)"
  sed -i "s/APP_PASSWORD=change-me/APP_PASSWORD=$password/" .env
  chmod 600 .env
  echo "Login: admin | Password: $password (also saved in .env)"
fi
mkdir -p data models
bash scripts/dependencies.sh
bash scripts/build-llama.sh
.venv/bin/python -m unittest discover -s tests -v
# Stage model downloads are resumable; inference never requires an external API.
bash scripts/download-models.sh
user="$(id -un)"
group="$(id -gn)"
for component in worker web; do
  unit="$(mktemp)"
  cat > "$unit" <<EOF
[Unit]
Description=Viet Voice Studio $component
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$user
Group=$group
WorkingDirectory=$ROOT
ExecStart=/bin/bash "$ROOT/scripts/launch.sh" $component
Restart=on-failure
RestartSec=5
KillMode=control-group
TimeoutStopSec=45
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
  "${SUDO[@]}" install -m 644 "$unit" "/etc/systemd/system/$SERVICE-$component.service"
  rm -f -- "$unit"
done
"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl enable "$SERVICE-worker" "$SERVICE-web"
bash scripts/start.sh
echo 'Installed. Open http://127.0.0.1:8080 (or use an SSH tunnel). See README for remote access.'
