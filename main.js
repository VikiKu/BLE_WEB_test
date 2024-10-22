//00001234-cc7a-482a-984a-7f2ed5b3e58f сервис
//00009000-8e22-4541-9d4c-21edae82ed19 write
//00005678-8e22-4541-9d4c-21edae82ed19 notify (STM32_BLE)
//-------
//(MY_P2P)
//0000fe40-cc7a-482a-984a-7f2ed5b3e58f
//0000fe41-8e22-4541-9d4c-21edae82ed19
//0000fe42-8e22-4541-9d4c-21edae82ed19

// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');

const progressBar = document.getElementById('progressBar');
let progressBarStep = 10;

const functionQueue = []; // очередь функций передачи данных
let functionQueueIndex = 0; // индекс функции для выполнения очереди
let bluetoothBufIndex = 0; // индекс для контроля переданных посылок по БТ
let bluetoothDelay = 20; // паузы между посылками

// Кэш объекта выбранного устройства
let deviceCache = null;

// Кэш для характеристик
let notificationCharacteristic = null;
let writeCharacteristic = null;

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

// Запуск выбора Bluetooth устройства и подключение
function connect() {
  return (deviceCache ? Promise.resolve(deviceCache) :
      requestBluetoothDevice()).
      then(device => connectDeviceAndCacheCharacteristics(device)).
      then(() => startNotifications()).
      catch(error => log(error));
}

// Запрос выбора Bluetooth устройства
function requestBluetoothDevice() {
  log('Requesting bluetooth device...');

  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true, // Принимаем все устройства без фильтрации
    //optionalServices: ['0000fe40-cc7a-482a-984a-7f2ed5b3e58f']
  }).then(device => {
    log('"' + device.name + '" bluetooth device selected');
    deviceCache = device;

    // Добавляем обработчик события разъединения
    deviceCache.addEventListener('gattserverdisconnected', handleDisconnection);

    return deviceCache;
  });
}

// Обработчик разъединения
function handleDisconnection(event) {
  let device = event.target;

  log('"' + device.name + '" bluetooth device disconnected, trying to reconnect...');

  connectDeviceAndCacheCharacteristics(device)
      .then(() => startNotifications())
      .catch(error => log(error));
}

// Подключение к устройству и получение характеристик
function connectDeviceAndCacheCharacteristics(device) {
  if (device.gatt.connected && notificationCharacteristic && writeCharacteristic) {
    return Promise.resolve();
  }

  log('Connecting to GATT server...');

  return device.gatt.connect()
      .then(server => {
        log('GATT server connected, getting service...');
        return server.getPrimaryService(['0000fe40-cc7a-482a-984a-7f2ed5b3e58f']); // UUID сервиса
      })
      .then(service => {
        log('Service found, getting characteristics...');

        // Получаем обе характеристики: для уведомлений и записи
        return Promise.all([
          service.getCharacteristic(['0000fe42-8e22-4541-9d4c-21edae82ed19']), // UUID для уведомлений
          service.getCharacteristic(['0000fe41-8e22-4541-9d4c-21edae82ed19'])  // UUID для записи
        ]);
      })
      .then(characteristics => {
        log('Characteristics found');
        notificationCharacteristic = characteristics[0]; // для уведомлений
        writeCharacteristic = characteristics[1];        // для записи
      });
}

// Включение уведомлений об изменении характеристики
function startNotifications() {
  log('Starting notifications...');

  return notificationCharacteristic.startNotifications()
      .then(() => {
        log('Notifications started');
        notificationCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
      });
}

// Вывод данных в терминал
function log(data, type = '') {
  terminalContainer.insertAdjacentHTML('beforeend', '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
}

// Отключиться от устройства
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

  // Удаляем слушатели уведомлений
  if (notificationCharacteristic) {
    notificationCharacteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
    notificationCharacteristic = null;
  }

  writeCharacteristic = null;
  deviceCache = null;
}

// Получение данных из уведомлений
function handleCharacteristicValueChanged(event) {
  let value = new TextDecoder().decode(event.target.value);
  log(value, 'in');
}

// Отправка данных на устройство
function send(data) {
  data = String(data);

  if (!data || !writeCharacteristic) {
    return;
  }

  data += '\n';

  if (data.length > 20) {
    let chunks = data.match(/(.|[\r\n]){1,20}/g);

    writeToCharacteristic(chunks[0]);

    for (let i = 1; i < chunks.length; i++) {
      setTimeout(() => {
        writeToCharacteristic(chunks[i]);
      }, i * 100);
    }
  } else {
    writeToCharacteristic(data);
  }

  log(data, 'out');
}

// Запись данных в характеристику
function writeToCharacteristic(data) {
  const uint8Array = new Uint8Array(data);

  const newArray = new Uint8Array(uint8Array.length + 1);
  newArray[0] = (48 + bluetoothBufIndex);
  newArray.set(uint8Array, 1);

  const arrayBuffer = newArray.buffer;

  writeCharacteristic.writeValue(arrayBuffer)
    .then(() => {
      progressBar.value += progressBarStep;
      functionQueueIndex++;
      bluetoothBufIndex++;
      if (bluetoothBufIndex > 9) bluetoothBufIndex = 0;

      bluetoothDelay = 20;
    })
    .catch(error => {
      console.error('Ошибка записи в характеристику Bluetooth:', error);
      bluetoothDelay = 100;
    });
}

// Выполнение очереди функций
async function executeFunctionQueue() {
  if (functionQueueIndex < functionQueue.length) {
    const currentFunction = functionQueue[functionQueueIndex];

    try {
      await currentFunction();
    } catch (error) {
      console.error('function executeFunctionQueue:', error);
    } finally {
      setTimeout(executeFunctionQueue, bluetoothDelay);
    }
  } else {
    log('Loading is complete!\n');
  }
}
