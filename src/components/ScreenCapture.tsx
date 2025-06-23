import React, { useState } from 'react';
import './ScreenCapture.css';

interface ScreenCaptureProps {
  onCapture: (imageUrl: string) => void;
  isLoading: boolean;
}

const ScreenCapture: React.FC<ScreenCaptureProps> = ({
  onCapture,
  isLoading
}) => {
  const [captureMethod, setCaptureMethod] = useState<'screen' | 'file'>('screen');
  const [error, setError] = useState<string>('');

  const handleScreenCapture = async () => {
    setError('');
    
    // 브라우저 지원 확인
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError('이 브라우저는 화면 캡쳐를 지원하지 않습니다. Chrome, Firefox, Edge를 사용해주세요.');
      return;
    }

    // HTTPS 확인
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setError('화면 캡쳐는 HTTPS 또는 localhost에서만 동작합니다.');
      return;
    }

    try {
      console.log('화면 캡쳐 요청 시작...');
      
      // 화면 캡쳐 API 사용
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      console.log('화면 캡쳐 스트림 획득 성공');

      // 비디오 엘리먼트 생성
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      
      // 비디오 재생 시작
      await video.play();
      console.log('비디오 재생 시작');

      // 비디오가 로드될 때까지 기다림
      await new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => {
          console.log('비디오 메타데이터 로드 완료');
          resolve();
        });
      });

      // 약간의 지연 후 캡쳐 (프레임이 완전히 로드되도록)
      await new Promise(resolve => setTimeout(resolve, 500));

      // 캔버스에 비디오 프레임 캡쳐
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        // 이미지 URL 생성
        const imageUrl = canvas.toDataURL('image/png');
        console.log('이미지 캡쳐 완료');
        onCapture(imageUrl);
      } else {
        throw new Error('Canvas context를 생성할 수 없습니다.');
      }

      // 스트림 종료
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('스트림 트랙 종료');
      });

    } catch (error: any) {
      console.error('화면 캡쳐 실패:', error);
      
      if (error.name === 'NotAllowedError') {
        setError('화면 캡쳐 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
      } else if (error.name === 'NotSupportedError') {
        setError('이 브라우저는 화면 캡쳐를 지원하지 않습니다.');
      } else if (error.name === 'NotFoundError') {
        setError('캡쳐할 화면을 찾을 수 없습니다.');
      } else if (error.name === 'AbortError') {
        setError('사용자가 화면 캡쳐를 취소했습니다.');
      } else {
        setError(`화면 캡쳐 실패: ${error.message || '알 수 없는 오류'}`);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        onCapture(imageUrl);
        setError('');
      };
      reader.readAsDataURL(file);
    } else {
      setError('올바른 이미지 파일을 선택해주세요.');
    }
  };

  const clearError = () => {
    setError('');
  };

  return (
    <div className="screen-capture">
      <div className="capture-header">
        <h3>이미지 캡쳐</h3>
        <div className="capture-methods">
          <button
            className={`method-button ${captureMethod === 'screen' ? 'active' : ''}`}
            onClick={() => {
              setCaptureMethod('screen');
              clearError();
            }}
          >
            화면 캡쳐
          </button>
          <button
            className={`method-button ${captureMethod === 'file' ? 'active' : ''}`}
            onClick={() => {
              setCaptureMethod('file');
              clearError();
            }}
          >
            파일 업로드
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button className="error-close" onClick={clearError}>✕</button>
          </div>
          {error.includes('권한') && (
            <div className="error-help">
              <p><strong>권한 허용 방법:</strong></p>
              <ul>
                <li>Chrome: 주소창 왼쪽 자물쇠 아이콘 → 사이트 설정 → 카메라 허용</li>
                <li>Firefox: 주소창 왼쪽 방패 아이콘 → 권한 → 화면 공유 허용</li>
                <li>페이지를 새로고침 후 다시 시도해보세요</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>처리 중...</p>
        </div>
      )}

      <div className="capture-content">
        {captureMethod === 'screen' ? (
          <div className="screen-capture-section">
            <div className="capture-info">
              <h4>🖥️ 화면 캡쳐</h4>
              <p>브라우저의 화면 공유 기능을 사용하여 화면을 캡쳐합니다.</p>
              <ul>
                <li>전체 화면 또는 특정 창을 선택할 수 있습니다</li>
                <li>브라우저에서 권한 요청이 나타납니다</li>
                <li>캡쳐 후 자동으로 OCR 분석이 시작됩니다</li>
              </ul>
              <div className="browser-requirements">
                <p><strong>요구사항:</strong></p>
                <p>• Chrome 72+, Firefox 66+, Safari 13+ 지원</p>
                <p>• HTTPS 또는 localhost 환경 필요</p>
              </div>
            </div>
            <button 
              className="capture-screen-button"
              onClick={handleScreenCapture}
              disabled={isLoading}
            >
              {isLoading ? '캡쳐 중...' : '🎬 화면 캡쳐 시작'}
            </button>
          </div>
        ) : (
          <div className="file-upload-section">
            <div className="upload-info">
              <h4>📁 파일 업로드</h4>
              <p>이미지 파일을 직접 업로드하여 OCR 분석을 수행합니다.</p>
              <ul>
                <li>PNG, JPG, GIF 등 이미지 파일 지원</li>
                <li>고화질 이미지일수록 더 정확한 결과</li>
                <li>텍스트가 선명한 이미지를 권장합니다</li>
              </ul>
            </div>
            <div className="file-upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                id="file-input"
                className="file-input"
              />
              <label htmlFor="file-input" className="file-upload-button">
                📎 이미지 파일 선택
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="usage-tips">
        <h4>💡 사용 팁</h4>
        <ul>
          <li><strong>화면 캡쳐:</strong> 텍스트가 포함된 화면이나 창을 선택하세요</li>
          <li><strong>파일 업로드:</strong> 스크린샷이나 문서 이미지를 사용하세요</li>
          <li><strong>최적화:</strong> 텍스트가 선명하고 배경과 대비가 좋은 이미지가 최적입니다</li>
          <li><strong>문제 해결:</strong> 에러 발생 시 페이지를 새로고침하고 다시 시도하세요</li>
        </ul>
      </div>
    </div>
  );
};

export default ScreenCapture; 