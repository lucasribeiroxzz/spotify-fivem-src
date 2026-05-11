local Config = {

  refreshRate = 4,
  realism = true,

  realismIgnore = {
    [`amarokbr`] = true,
    [`saveirog7`] = true,
    [`pbus2`] = true,
    [`panto`] = true,
  },

  baseVolume = 0.5,
  dropRadioKey = 'g',
  minimumHealth = 101,
  stopOnDeath = true,

  blockedInteriors = {},

  isWindowsOpen = function(vehicle)
  end,

  notify = function(bool)
    if type(bool) == 'number' then
      TriggerEvent('Notify', 'sucesso', 'Volume atual: '..bool..'%')
    elseif bool then
      TriggerEvent('Notify', 'sucesso', 'Status do som: Ligado')
    else
      TriggerEvent('Notify', 'negado', 'Status do som: Desligado')
    end
  end,

}

return Config
