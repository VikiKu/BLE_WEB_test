// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
// Кэш объекта выбранного устройства
let deviceCache = null;
// Кэш объекта характеристики
let characteristicCache = null;

// Подключение к устройству при нажатии на кнопку Connect
connectButton.addEventListener('click', function() {
  connect();
});

// Отключение от устройства при нажатии на кнопку Disconnect
disconnectButton.addEventListener('click', function() {
  disconnect();
});

// Обработка события отправки формы
sendForm.addEventListener('submit', function(event) {
  event.preventDefault(); // Предотвратить отправку формы
  send(inputField.value); // Отправить содержимое текстового поля
  inputField.value = '';  // Обнулить текстовое поле
  inputField.focus();     // Вернуть фокус на текстовое поле
});

// Запустить выбор Bluetooth устройства и подключиться к выбранному
function connect() {
  return (deviceCache ? Promise.resolve(deviceCache) :
      requestBluetoothDevice())
      .then(device => connectDeviceAndCacheCharacteristic(device))
      .then(characteristic => startNotifications(characteristic))
      .catch(error => log(error));
}

// Отключиться от подключенного устройства
function disconnect() {
  if (deviceCache) {
    log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
    deviceCache.removeEventListener('gattserverdisconnected', handleDisconnection);

    if (deviceCache.gatt.connected) {
      deviceCache.gatt.disconnect();
      log('"' + deviceCache.name + '" bluetooth device disconnected');
    } else {
      log('"' + deviceCache.name + '" bluetooth device is already disconnected');
    }
  }

  characteristicCache = null;
  deviceCache = null;
}

// Отправить данные подключенному устройству
function send(data) {
  if (characteristicCache && characteristicCache.writeValue) {
    let encoder = new TextEncoder();
    let value = encoder.encode(data);
    characteristicCache.writeValue(value)
      .then(() => log('Sent: ' + data))
      .catch(error => log(error));
  } else {
    log('No characteristic to send data to.');
  }
}

// Запрос выбора Bluetooth устройства
function requestBluetoothDevice() {
  log('Requesting bluetooth device...');

  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true, // Принимаем все устройства без фильтрации
    optionalServices: [] // Пытаемся получить все доступные сервисы
  })
    .then(device => {
      log('"' + device.name + '" bluetooth device selected');
      deviceCache = device;

      // Добавленная строка
      deviceCache.addEventListener('gattserverdisconnected', handleDisconnection);

      return deviceCache;
    });
}

// Обработчик разъединения
function handleDisconnection(event) {
  let device = event.target;

  log('"' + device.name + '" bluetooth device disconnected, trying to reconnect...');

  connectDeviceAndCacheCharacteristic(device)
    .then(characteristic => startNotifications(characteristic))
    .catch(error => log(error));
}

// Подключение к определенному устройству, получение первого доступного сервиса и характеристики
function connectDeviceAndCacheCharacteristic(device) {
  if (device.gatt.connected && characteristicCache) {
    return Promise.resolve(characteristicCache);
  }

  log('Connecting to GATT server...');

  return device.gatt.connect()
    .then(server => {
      log('GATT server connected, getting services...');

      return server.getPrimaryServices(); // Получаем все доступные сервисы
    })
    .then(services => {
      log('Services found: ' + services.length);
      // Пробуем получить первую доступную характеристику из первого сервиса
      return services[0].getCharacteristics();
    })
    .then(characteristics => {
      log('Characteristics found: ' + characteristics.length);
      characteristicCache = characteristics[0]; // Сохраняем первую найденную характеристику

      return characteristicCache;
    });
}

// Включение получения уведомлений об изменении характеристики
function startNotifications(characteristic) {
  if (characteristic.properties.notify) {
    log('Starting notifications...');

    return characteristic.startNotifications()
      .then(() => {
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
        log('Notifications started');
      });
  } else {
    log('This characteristic does not support notifications.');
    return Promise.resolve();
  }
}

// Обработчик изменения значения характеристики
function handleCharacteristicValueChanged(event) {
  let value = new TextDecoder().decode(event.target.value);
  log('Received: ' + value);
}

// Вывод в терминал
function log(data, type = '') {
  terminalContainer.insertAdjacentHTML('beforeend',
      '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
}
