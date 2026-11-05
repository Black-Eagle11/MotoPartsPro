
FROM php:8.4-apache

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    unzip \
    libcurl4-openssl-dev \
    libicu-dev \
    libzip-dev \
    libxml2-dev \
    libonig-dev \
    && docker-php-ext-install \
    pdo_mysql \
    curl \
    mbstring \
    bcmath \
    intl \
    zip \
    dom \
    xml \
    xmlreader \
    xmlwriter \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN sed -ri 's!/var/www/html!/var/www/html/public!g' \
    /etc/apache2/sites-available/000-default.conf \
    && printf '\n<Directory /var/www/html/public>\nAllowOverride All\nRequire all granted\n</Directory>\n' \
    >> /etc/apache2/apache2.conf \
    && composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80

CMD ["bash", "-lc", "php artisan migrate --force && apache2-foreground"]
