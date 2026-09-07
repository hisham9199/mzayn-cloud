#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  مزاين - سكريبت إعداد سيرفر Hetzner من الصفر
#  تشغيل: bash setup_hetzner.sh
# ═══════════════════════════════════════════════════════════════════
set -e

echo "🐪 بدء إعداد سيرفر مزاين..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. تحديث النظام
echo "📦 تحديث النظام..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. تثبيت Docker
echo "🐋 تثبيت Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. تثبيت Docker Compose Plugin
echo "🔧 تثبيت Docker Compose..."
apt-get install -y docker-compose-plugin

# 4. تثبيت أدوات مفيدة
apt-get install -y git htop curl ufw

# 5. جدار الحماية (Firewall)
echo "🔒 إعداد جدار الحماية..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (مستقبلاً)
ufw --force enable

# 6. سحب المشروع
echo "📥 تحميل مشروع مزاين..."
if [ -d "/opt/mzayn" ]; then
    echo "   ← المشروع موجود، تحديث..."
    cd /opt/mzayn
    git pull origin main
else
    git clone https://github.com/hisham9199/mzayn-cloud.git /opt/mzayn
    cd /opt/mzayn
fi

# 7. إنشاء ملف البيئة
if [ ! -f "/opt/mzayn/.env" ]; then
    echo "⚙️  إنشاء ملف البيئة..."
    # توليد كلمة مرور عشوائية
    DB_PASS=$(openssl rand -base64 20 | tr -dc 'A-Za-z0-9!@#' | head -c 20)
    cat > /opt/mzayn/.env << EOF
# ═══════════════════════════════════════
#  مزاين - إعدادات الإنتاج
# ═══════════════════════════════════════

# قاعدة البيانات
DB_PASSWORD=${DB_PASS}

# Google Vision (اختياري - EasyOCR هو الرئيسي)
GOOGLE_VISION_API_KEY=

# Discord Bot (اختياري)
DISCORD_BOT_TOKEN=
EOF
    echo "✅ تم إنشاء ملف .env بكلمة مرور قوية"
    echo "   📋 احفظ هذه المعلومات:"
    echo "   DB_PASSWORD=${DB_PASS}"
fi

# 8. إنشاء مجلدات البيانات
echo "📁 إنشاء مجلدات البيانات..."
mkdir -p /opt/mzayn/data/uploads
mkdir -p /opt/mzayn/data/backups
mkdir -p /opt/mzayn/data/postgres

# 9. بناء وتشغيل الخدمات
echo "🚀 بناء وتشغيل مزاين..."
cd /opt/mzayn
docker compose -f docker-compose.prod.yml up -d --build

# 10. انتظار جاهزية قاعدة البيانات
echo "⏳ انتظار جاهزية قاعدة البيانات..."
sleep 15

# 11. عرض الحالة
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ تم التثبيت بنجاح!"
echo ""
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "🌐 الرابط: http://${SERVER_IP}"
echo "📚 API Docs: http://${SERVER_IP}/api/docs"
echo ""
echo "📊 حالة الخدمات:"
docker compose -f docker-compose.prod.yml ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
