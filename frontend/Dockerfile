FROM nginx:1.27.3-alpine

# nginx 官方镜像启动时会对 templates 目录执行 envsubst，生成 /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY public/ /usr/share/nginx/html/

EXPOSE 80
