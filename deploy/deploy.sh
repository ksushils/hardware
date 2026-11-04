#!/usr/bin/env bash
# One-command install/update for TechRevive on a Linux VPS (Ubuntu/Debian).
# First run:   DOMAIN=shop.example.com bash deploy.sh
# Updates:     bash /var/www/techrevive/deploy/deploy.sh
# Options (env): APP_DIR (/var/www/techrevive), DATA_DIR (/var/www/techrevive-data), PORT (3100),
#                BRANCH (claude/stoic-goodall-x035q0), REPO (git@github.com:ksushils/hardware.git), SEED=1 to load demo data
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/techrevive}"
DATA_DIR="${DATA_DIR:-/var/www/techrevive-data}"
PORT="${PORT:-3100}"
BRANCH="${BRANCH:-claude/stoic-goodall-x035q0}"
REPO="${REPO:-git@github.com:ksushils/hardware.git}"
DOMAIN="${DOMAIN:-}"

say() { printf "\n\033[1;32m==> %s\033[0m\n" "$*"; }

# 1. Node 22 + PM2 (left alone if already installed)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || { say "Installing PM2"; sudo npm i -g pm2; }

# 2. Code
if [ ! -d "$APP_DIR/.git" ]; then
  say "Cloning $REPO ($BRANCH) into $APP_DIR"
  sudo mkdir -p "$APP_DIR" && sudo chown "$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
else
  say "Updating code"
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" checkout "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi
cd "$APP_DIR"

# 3. Persistent data (database + uploads live outside the code folder, so updates never touch them)
sudo mkdir -p "$DATA_DIR/uploads" && sudo chown -R "$USER" "$DATA_DIR"
[ -L public/uploads ] || { rm -rf public/uploads; ln -s "$DATA_DIR/uploads" public/uploads; }

# 4. Environment (created once, then kept)
if [ ! -f "$DATA_DIR/.env" ]; then
  say "Creating $DATA_DIR/.env (edit it to add Stripe / Resend keys)"
  cat > "$DATA_DIR/.env" <<ENV
DATABASE_URL="file:$DATA_DIR/prod.db"
AUTH_SECRET="$(openssl rand -hex 32)"
NEXT_PUBLIC_SITE_URL="https://${DOMAIN:-shop.example.com}"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
RESEND_API_KEY=""
EMAIL_FROM="TechRevive <support@${DOMAIN:-example.com}>"
ADMIN_EMAIL="admin@${DOMAIN:-techrevive.ae}"
ADMIN_PASSWORD="$(openssl rand -base64 12)"
PORT=$PORT
ENV
  FIRST_RUN=1
fi
ln -sf "$DATA_DIR/.env" .env
set -a; . ./.env; set +a

# 5. Install, migrate, build
say "Installing dependencies"
npm ci --no-audit --no-fund
say "Updating database schema"
npx prisma db push --skip-generate
npx prisma generate
if [ "${FIRST_RUN:-0}" = 1 ] || [ "${SEED:-0}" = 1 ]; then
  say "Seeding store data (categories, demo products, pages, admin user)"
  npx tsx prisma/seed.ts
fi
say "Building"
npx next build

# 6. Run with PM2 (restart on update, start on boot)
say "Starting on 127.0.0.1:$PORT"
PORT=$PORT pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

# 7. nginx site (only if nginx exists and the site isn't configured yet)
if [ -n "$DOMAIN" ] && command -v nginx >/dev/null && [ ! -f /etc/nginx/sites-available/techrevive ]; then
  say "Adding nginx site for $DOMAIN"
  sed "s/shop.example.com/$DOMAIN/g; s/127.0.0.1:3100/127.0.0.1:$PORT/g" deploy/nginx.conf | sudo tee /etc/nginx/sites-available/techrevive >/dev/null
  sudo ln -sf /etc/nginx/sites-available/techrevive /etc/nginx/sites-enabled/techrevive
  sudo nginx -t && sudo systemctl reload nginx
  command -v certbot >/dev/null && sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect || echo "Run certbot manually for HTTPS."
fi

curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && say "Done. Site is up on port $PORT${DOMAIN:+ → https://$DOMAIN}"
[ "${FIRST_RUN:-0}" = 1 ] && echo "Admin login: $ADMIN_EMAIL / $ADMIN_PASSWORD  (also in $DATA_DIR/.env; change it after first login)"
