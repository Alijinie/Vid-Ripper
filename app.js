const songInput = document.getElementById('songInput');
const extractBtn = document.getElementById('extractInstrumental');
const exportAudioBtn = document.getElementById('exportAudio');
const preview = document.getElementById('preview');
const loading = document.getElementById('loading');
const songFileName = document.getElementById('song-file-name');
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let instrumentalBuffer; // To store processed audio

// Load song on input change
songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    songFileName.textContent = file.name;
    const arrayBuffer = await file.arrayBuffer();
    instrumentalBuffer = await audioContext.decodeAudioData(arrayBuffer);
  }
});

extractBtn.addEventListener('click', async () => {
  if (!instrumentalBuffer || instrumentalBuffer.numberOfChannels < 2) {
    alert('Upload a stereo audio file first.');
    return;
  }

  // Create a new buffer for processed audio
  const outputBuffer = audioContext.createBuffer(
    2,
    instrumentalBuffer.length,
    instrumentalBuffer.sampleRate
  );

  const left = instrumentalBuffer.getChannelData(0);
  const right = instrumentalBuffer.getChannelData(1);
  const outLeft = outputBuffer.getChannelData(0);
  const outRight = outputBuffer.getChannelData(1);

  // Basic phase-cancellation vocal removal.
  // This technique is not perfect and may result in audible artifacts or
  // remove instruments that are panned to the center.
  for (let i = 0; i < instrumentalBuffer.length; i++) {
    const mono = (left[i] - right[i]) / 2; // Average difference
    outLeft[i] = mono;
    outRight[i] = mono;
  }

  instrumentalBuffer = outputBuffer; // Update with processed buffer

  // Preview
  const source = audioContext.createBufferSource();
  source.buffer = instrumentalBuffer;
  source.connect(audioContext.destination);
  source.start();

  // Set for HTML audio preview
  const wavBlob = await bufferToWav(instrumentalBuffer);
  preview.src = URL.createObjectURL(wavBlob);
});

// Helper: Convert AudioBuffer to WAV Blob
async function bufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2; // 16-bit PCM
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      view.setInt16(offset, sample * 0x7FFF, true); // 16-bit
      offset += 2;
    }
  }


  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

exportAudioBtn.addEventListener('click', async () => {
  if (!instrumentalBuffer) return;
  const wavBlob = await bufferToWav(instrumentalBuffer);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(wavBlob);
  link.download = 'instrumental.wav';
  link.click();
});