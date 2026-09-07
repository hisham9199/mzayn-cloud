#!/bin/bash
set -e

echo "تحديث النظام..."
apt-get update -qq && apt-get upgrade -y -qq

echo "تثبيت Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
apt-get install -y docker-compose-plugin git curl ufw htop

echo "إعداد جدار الحماية..."
ufw allow 22/tcp && ufw allow 80/tcp && ufw --force enable

echo "سحب المشروع من GitHub..."
git clone https://github.com/hisham9199/mzayn-cloud.git /opt/mzayn || (cd /opt/mzayn && git pull)

echo "إنشاء ملف البيئة..."
cd /opt/mzayn
if [ ! -f ".env" ]; then
cat > .env << 'ENVEOF'
DB_PASSWORD=MzaYn@2025Secure!
GOOGLE_VISION_API_KEY=
DISCORD_BOT_TOKEN=
ENVEOF
fi

echo "تشغيل المشروع..."
docker compose -f docker-compose.prod.yml up -d --build

echo "الحالة:"
docker compose -f docker-compose.prod.yml ps
IP=$(curl -s ifconfig.me)
echo "==================================="
echo "مزاين يعمل على: http://$IP"
echo "==================================="
