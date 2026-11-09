const DEFAULT_BITRATE = 14000;
function bitrate(value = DEFAULT_BITRATE) {
  if (!Number.isInteger(value) || value < 5000 || value > 30000)
    throw Error('비트레이트는 5,000~30,000 Kbps 정수로 입력해 주세요.');
  return value;
}
function encodingArgs(value) {
  const rate = bitrate(value);
  return ['-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
    '-c:v','libx264','-threads','2','-preset','veryfast','-tune','zerolatency','-pix_fmt','yuv420p',
    '-r','30','-fps_mode','cfr','-g','60','-keyint_min','60','-sc_threshold','0','-b:v',rate+'k',
    '-minrate',rate+'k','-maxrate',rate+'k','-bufsize',(rate*2)+'k','-x264-params','nal-hrd=cbr:force-cfr=1',
    '-c:a','aac','-b:a','128k','-ar','48000','-ac','2'];
}
module.exports = {DEFAULT_BITRATE, bitrate, encodingArgs};
