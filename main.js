 // Получение ссылок на элементы UI
 let connectButton = document.getElementById('connect');
 let disconnectButton = document.getElementById('disconnect');
 let terminalContainer = document.getElementById('terminal');
 let sendForm = document.getElementById('send-form');
 let inputField = document.getElementById('input');
 // Кэш объекта выбранного устройства
 let deviceCache = null
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
  inputField.value = ''; // Обнулить текстовое поле
  inputField.focus(); // Вернуть фокус на текстовое поле
 });
 
 // Запустить выбор Bluetooth устройства и подключиться к выбранному
 function connect() {
  return (deviceCache ? Promise.resolve(deviceCache) :
  requestBluetoothDevice()).
  then(device => connectDeviceAndCacheCharacteristic(device)).
  then(characteristic => startNotifications(characteristic)).
  catch(error => log(error));
 }
 
 // Отключиться от подключенного устройства
 function disconnect() {
  if (deviceCache) {
  log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
  deviceCache.removeEventListener('gattserverdisconnected',
  handleDisconnection);
 
  if (deviceCache.gatt.connected) {
  deviceCache.gatt.disconnect();
  log('"' + deviceCache.name + '" bluetooth device disconnected');
  }
  else {
  log('"' + deviceCache.name +
  '" bluetooth device is already disconnected');
  }
  }
 
  characteristicCache = null;
  deviceCache = null;
 }
 
 // Отправить данные подключенному устройству
 function send(data) {
  //
 }
 
 // Запрос выбора Bluetooth устройства
 function requestBluetoothDevice() {
  log('Requesting bluetooth device...');
 
  return navigator.bluetooth.requestDevice({
  acceptAllDevices: true, // Принимаем все устройства без фильтрации
  optionalServices: ['00001234-cc7a-482a-984a-7f2ed5b3e58f']
   //filters:[{services: [0x1234]}],
  }).
  then(device => {
  log('"' + device.name + '" bluetooth device selected');
  deviceCache = device;
 
  // Добавленная строка
  deviceCache.addEventListener('gattserverdisconnected',
  handleDisconnection);
 
  return deviceCache;
  });
 }
 // Обработчик разъединения
 function handleDisconnection(event) {
  let device = event.target;
 
  log('"' + device.name +
  '" bluetooth device disconnected, trying to reconnect...');
 
  connectDeviceAndCacheCharacteristic(device).
  then(characteristic => startNotifications(characteristic)).
  catch(error => log(error));
 }
 // Подключение к определенному устройству, получение сервиса и характеристики
 function connectDeviceAndCacheCharacteristic(device) {
 if (device.gatt.connected && characteristicCache) {
  return Promise.resolve(characteristicCache);
  }
 
  log('Connecting to GATT server...');
 
  return device.gatt.connect().
  then(server => {
  log('GATT server connected, getting service...');
 
  return server.getPrimaryService(0x1234);
  }).
  then(service => {
  log('Service found, getting characteristic...');
 
  return service.getCharacteristic(0x5678);
  }).
  then(characteristic => {
  log('Characteristic found');
  characteristicCache = characteristic;
 
  return characteristicCache;
  });
 }
 
 // Включение получения уведомлений об изменении характеристики
 function startNotifications(characteristic) {
  log('Starting notifications...');
 
  return characteristic.startNotifications().
  then(() => {
  log('Notifications started');
  });
 }
 
 // Вывод в терминал
 function log(data, type = '') {
  terminalContainer.insertAdjacentHTML('beforeend',
  '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
 }
