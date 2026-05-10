# 🎵 PRINCIPAL — Music System for FiveM

<p align="center">
  <img src="https://img.shields.io/badge/FiveM-Resource-green?style=for-the-badge&logo=fivem" alt="FiveM"/>
  <img src="https://img.shields.io/badge/Framework-vRP-blue?style=for-the-badge" alt="vRP"/>
  <img src="https://img.shields.io/badge/License-Open%20Source-brightgreen?style=for-the-badge" alt="License"/>
  <img src="https://img.shields.io/badge/Author-Lucassx-blueviolet?style=for-the-badge" alt="Author"/>
</p>

---

## 📖 Sobre

**PRINCIPAL** é um sistema de música completo para servidores FiveM com framework **vRP**. Interface inspirada no Spotify com player integrado, sistema de DJ, playlists, favoritos, histórico e sincronização de áudio 3D entre jogadores.

---

## ✨ Funcionalidades

| Feature | Descrição |
|---------|-----------|
| 🎶 **Player de Música** | Interface estilo Spotify com busca no YouTube |
| 🎧 **Sistema de DJ** | Mesas de DJ espalhadas pelo mapa com alcance configurável |
| 📻 **Caixa de Som (JBL)** | Prop 3D que o jogador carrega na mão |
| 🔊 **Áudio 3D** | Som espacializado com atenuação por distância |
| 📱 **Mini Player** | Widget flutuante quando a UI principal está fechada |
| ❤️ **Favoritos** | Salve suas músicas favoritas |
| 📋 **Playlists** | Crie e gerencie playlists personalizadas |
| 📜 **Histórico** | Registro automático das músicas tocadas |
| 🔇 **Controle de Mute** | Mute/unmute do som de outros jogadores |
| 🚗 **Bluetooth Veicular** | Conecta automaticamente ao entrar no veículo |
| 🎨 **UI Customizável** | Banner e avatar configuráveis |

---

## 📋 Dependências

- [vRP Framework](https://github.com/vRP-framework/vRP)
- [oxmysql](https://github.com/overextended/oxmysql)

---

## 🚀 Instalação

### 1. Copie o recurso
```
Copie a pasta para: resources/[scripts]/principal/
```

### 2. Importe o banco de dados
Execute o arquivo `principal.sql` no seu MySQL/MariaDB.

### 3. Configure o `server.cfg`
```cfg
ensure oxmysql
ensure vrp
ensure principal
```

### 4. Reinicie o servidor
```
ensure principal
```

---

## 💬 Comandos

| Comando | Descrição |
|---------|-----------|
| `/som` | Abre o player de música |
| `/somoff` | Muta todo o som de música |
| `/somon` | Desmuta o som |
| `/volume [0-100]` | Define o volume manualmente |
| `/dj` | Abre a mesa de DJ (precisa estar próximo) |
| `/sommodel <modelo>` | Troca o modelo do prop da caixa de som |

### Teclas
| Tecla | Ação |
|-------|------|
| `G` | Soltar/pegar a caixa de som no chão |
| `E` | Interagir com mesa de DJ (quando próximo) |

---

## ⚙️ Configuração

### `config.lua`
- Volume base, tecla de drop, vida mínima, comportamento ao morrer

### `shared/config.lua`
- Comando principal, modelo do prop, alcance de áudio, atenuação de volume, imagens da UI

### `config/dj_stations.lua`
- Mesas de DJ: coordenadas, alcance, volume, permissões, blips no mapa

---

## 📁 Estrutura

```
principal/
├── client.lua              # Lógica client-side
├── server.lua              # Lógica server-side
├── server_model.lua        # Comando para trocar modelo
├── config.lua              # Configurações gerais
├── fxmanifest.lua          # Manifest do recurso
├── principal.sql              # Schema do banco de dados
├── storage.json            # Cache local
├── shared/
│   └── config.lua          # Configurações compartilhadas
├── config/
│   └── dj_stations.lua     # Mesas de DJ
├── web/
│   ├── index.html          # Interface principal
│   ├── styles.css          # Estilos
│   ├── script.js           # Lógica da UI
│   ├── mini-player.js      # Mini player flutuante
│   ├── drag.js             # Sistema de arrastar janela
│   └── drag-functionality.js
└── stream/
    ├── rojo_jblboombox.ycd # Modelo 3D
    └── rojo_jblboombox.ytyp
```

---

## 🗄️ Banco de Dados

O sistema utiliza as seguintes tabelas:

- `videos` — Armazena metadados dos vídeos reproduzidos
- `likes` — Favoritos dos jogadores
- `playlists` — Playlists criadas pelos jogadores
- `playlist_videos` — Relação entre playlists e vídeos
- `history` — Histórico de reprodução

---

## 🎧 Sistema de DJ

As mesas de DJ podem ser configuradas em `config/dj_stations.lua`:

```lua
{
    name = "Vanilla Unicorn",
    coords = vector3(120.5, -1281.0, 29.5),
    range = 60.0,
    maxVolume = 90,
    permission = nil,        -- nil = livre para todos
    requireItem = false,
    item = nil,
    blip = {
        display = true,
        sprite = 136,
        color = 27,
        scale = 0.4
    }
}
```

---

## 🔊 Sistema de Áudio 3D

O áudio possui atenuação realista por distância com:
- **Zona neutra** — Volume estável quando muito próximo
- **Fade gradual** — Redução suave conforme se afasta
- **Suavização** — Transições de volume sem saltos bruscos

Configurável por tipo de fonte (veículo, prop, DJ) em `shared/config.lua`.

---

## 📄 Licença

Este projeto é **open source** e livre para uso, modificação e distribuição.

---

## 👤 Autor

Desenvolvido por **Lucassx**

---

<p align="center">
  <b>⭐ Se este projeto te ajudou, deixe uma estrela no repositório!</b>
</p>
