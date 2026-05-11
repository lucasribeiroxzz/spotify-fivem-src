fx_version 'cerulean'
game 'gta5'

author 'Lucassx'
description 'PRINCIPAL Music Player'
version '1.1.0'

ui_page 'web/index.html'

shared_scripts {
    'shared/config.lua',
    'config/dj_stations.lua',
}

client_scripts {
    'config.lua',
    'client.lua',
}

server_scripts {
    '@vrp/lib/utils.lua',
    '@oxmysql/lib/MySQL.lua',
    'server.lua',
}

files {
    'web/index.html',
    'web/styles.css',
    'web/dj-styles.css',
    'web/theme-spotify.css',
    'web/script.js',
    'web/mini-player.js',
    'web/drag.js',
    'web/drag-functionality.js',
    'web/youtube_cache.json',
    'web/assets/**/*',
    'stream/rojo_jblboombox.ycd',
    'stream/rojo_jblboombox.ytyp',
}

data_file 'DLC_ITYP_REQUEST' 'stream/rojo_jblboombox.ytyp'

dependencies {
    'oxmysql',
    'vrp',
}
