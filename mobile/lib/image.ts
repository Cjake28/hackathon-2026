import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// Lets the user take or pick a photo, shrinks it to 1024px and returns base64 JPEG (smaller = faster AI).
// Returns null if they cancel.
export async function pickImage(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const { uri, width, height } = result.assets[0];
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > 1024) context.resize(width >= height ? { width: 1024 } : { height: 1024 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return saved.base64 ?? null;
}
