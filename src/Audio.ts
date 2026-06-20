export default {
  yeti: {
    move: {
      '0': require('../assets/audio/yeti-hop-1.mp3'),
    },
    die: {
      '0': require('../assets/audio/yeti-grunt-1.mp3'),
    },
  },
  car: {
    passive: {
      '0': require('../assets/audio/car-engine-loop-deep.wav'),
      '1': require('../assets/audio/car-horn.wav'),
    },
    die: {
      '0': require('../assets/audio/carhit.mp3'),
      '1': require('../assets/audio/carsquish3.wav'),
    },
  },
  bg_music: require('../assets/audio/car-engine-loop-deep.wav'),

  button_in: require('../assets/audio/Pop_1.wav'),
  button_out: require('../assets/audio/Pop_2.wav'),

  coin: require('../assets/audio/Get Coin 73 wav.mp3'),

  banner: require('../assets/audio/bannerhit3-g.wav'),
  water: require('../assets/audio/watersplashlow.mp3'),
  trainAlarm: require('../assets/audio/Train_Alarm.wav'),
  train: {
    move: {
      '0': require('../assets/audio/train_pass_no_horn.wav'),
      '1': require('../assets/audio/train_pass_shorter.wav'),
    },
    die: {
      '0': require('../assets/audio/trainsplat.wav'),
    },
  },
};
