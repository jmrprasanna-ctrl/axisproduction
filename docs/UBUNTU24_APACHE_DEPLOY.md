# Ubuntu 24.04 + Apache Deployment Guide

This guide deploys `axis_production` on Ubuntu 24.04 LTS with:
- Apache2 for static frontend + reverse proxy
- Node.js backend managed by PM2
- PostgreSQL (local or managed)

## 1. Server prerequisites

On a new Ubuntu 24 server:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git apache2 build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Verify:

```bash
node -v
npm -v
apache2 -v
pm2 -v
```

## 2. Clone app

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/<your-user>/axis_production.git
sudo chown -R $USER:$USER /var/www/axis_production
cd /var/www/axis_production
npm install
```

## 3. Backend environment

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set real values (DB host/user/password, JWT secret, SMTP).

## 4. Start backend with PM2

```bash
cd /var/www/axis_production
pm2 start npm --name axis-production-backend -- run start
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u $USER --hp $HOME
```

Health check:

```bash
curl http://127.0.0.1:5000/api/health
```

## 5. Configure Apache

Use included template:

```bash
APP_DIR=/var/www/axis_production
DOMAIN=_
sed -e "s|__APP_DIR__|${APP_DIR}|g" -e "s|__DOMAIN__|${DOMAIN}|g" \
  ${APP_DIR}/deploy/ubuntu24/axis_production.apache.conf \
  | sudo tee /etc/apache2/sites-available/axis_production.conf >/dev/null
```

Enable modules and site:

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo a2dissite 000-default.conf || true
sudo a2ensite axis_production.conf
sudo apache2ctl configtest
sudo systemctl restart apache2
sudo systemctl enable apache2
```

Check:

```bash
curl -I http://127.0.0.1
curl http://127.0.0.1/api/health
```

## 6. One-command installer

You can run the included setup script:

```bash
cd /var/www/axis_production
chmod +x deploy/ubuntu24/install_apache_stack.sh
DOMAIN=your-domain.com APP_DIR=/var/www/axis_production \
  ./deploy/ubuntu24/install_apache_stack.sh https://github.com/<your-user>/axis_production.git main
```

## 7. Deploy updates

```bash
cd /var/www/axis_production
chmod +x deploy.sh rollback.sh
./deploy.sh main
```

Rollback example:

```bash
./rollback.sh HEAD~1
```

## 8. Optional HTTPS (Let's Encrypt)

After DNS points to your server:

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d your-domain.com -d www.your-domain.com
```
