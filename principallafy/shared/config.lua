return {
  command = 'som',

  permissions = {
    enabled = true,
    soundCommand = { 'Admin' },
    djCommand    = { 'Admin' },
    deniedMessage = 'Apenas administradores podem usar este comando.',
  },

  prop = 'rojo_jblboombox01',
  propFallback = 'prop_boombox_01',

  maxDistance = 1000000.0,

  dj = {
    {
      table = { 204.31, -861.66, 30.95 },
      speaker = { 202.99, -875.59, 30.95 },
      range = 50,
      volume = 150,
    },
  },

  range = {
    vehicle = {
      ['panto'] = 10,
    },
    radio = { 20, 50 },
  },

  blacklist = { 'spawn_do_veiculo' },
  allowBluetoothOnBikes = false,

  uiImages = {
    bannerUrl = 'https://media.discordapp.net/attachments/1411820081692020756/1436873050241892462/image.png?ex=69112fce&is=690fde4e&hm=528a903831920dbb79082f96c6e8d9b2e6237429c28141627c947fa53d4e0e9f&=&format=webp&quality=lossless&width=788&height=788',
    avatarUrl = 'https://i.ibb.co/DHpcsG0G/F.png',
  },

  attenuation = {
    nearRadius = 1.5,
    fadeStartRatio = 0.5,
    smoothingFactor = 0.15,

    vehicle = {
      nearRadius = 1.0,
      fadeStartRatio = 0.4,
      smoothingFactor = 0.15,
    },
    prop = {
      nearRadius = 1.5,
      fadeStartRatio = 0.5,
      smoothingFactor = 0.15,
    },
    dj = {
      nearRadius = 2.0,
      fadeStartRatio = 0.6,
      smoothingFactor = 0.2,
    },

    autoReactivateMovement = 0.5,
  },
}
