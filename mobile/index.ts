import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './src/widgets/handler';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Android home-screen widgets (Next class, Today) run this headless, without opening the app.
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
