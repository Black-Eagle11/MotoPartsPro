<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file stores credentials and configuration for third-party services
    | such as Postmark, Resend, Amazon SES, and Slack.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | MotoPartsPro
    |--------------------------------------------------------------------------
    |
    | Configuration for the initial administrator and local demo accounts.
    | All credentials are loaded from the backend .env file.
    |
    | IMPORTANT:
    | Keep demo credentials restricted to local development.
    | Never expose passwords in logs or commit .env to Git.
    |
    */

    'motopartspro' => [

        /*
        |--------------------------------------------------------------------------
        | Administrator Account
        |--------------------------------------------------------------------------
        */

        'admin_name' => env(
            'MOTOPARTSPRO_ADMIN_NAME',
            'MotoPartsPro Admin'
        ),

        'admin_email' => env(
            'MOTOPARTSPRO_ADMIN_EMAIL'
        ),

        'admin_password' => env(
            'MOTOPARTSPRO_ADMIN_PASSWORD'
        ),

        /*
        |--------------------------------------------------------------------------
        | Staff Demo Account
        |--------------------------------------------------------------------------
        */

        'staff_name' => env(
            'MOTOPARTSPRO_STAFF_NAME',
            'MotoPartsPro Staff'
        ),

        'staff_email' => env(
            'MOTOPARTSPRO_STAFF_EMAIL'
        ),

        'staff_password' => env(
            'MOTOPARTSPRO_STAFF_PASSWORD'
        ),

        /*
        |--------------------------------------------------------------------------
        | Member Demo Account
        |--------------------------------------------------------------------------
        */

        'member_name' => env(
            'MOTOPARTSPRO_MEMBER_NAME',
            'MotoPartsPro Member'
        ),

        'member_email' => env(
            'MOTOPARTSPRO_MEMBER_EMAIL'
        ),

        'member_password' => env(
            'MOTOPARTSPRO_MEMBER_PASSWORD'
        ),

    ],

];
