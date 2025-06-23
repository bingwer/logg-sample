import React, { useEffect, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import './OCRResult.css';

interface OCRResultProps {
  imageUrl: string;
  selectedArea?: { x: number; y: number; width: number; height: number } | null;
  onOcrResult: (result: string, engine?: string) => void;
}

const OCRResult: React.FC<OCRResultProps> = ({ imageUrl, selectedArea, onOcrResult }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState('kor+eng');
  const [preprocessImage, setPreprocessImage] = useState(true);
  const [psmMode, setPsmMode] = useState('6');
  const [scaleFactor, setScaleFactor] = useState(2);
  const [showPreprocessed, setShowPreprocessed] = useState(false);
  const [preprocessedImageUrl, setPreprocessedImageUrl] = useState<string | null>(null);
  const [ocrEngine, setOcrEngine] = useState<'tesseract' | 'google-vision'>('tesseract');
  const [googleVisionApiKey, setGoogleVisionApiKey] = useState('');
  const [ocrResult, setOcrResult] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (imageUrl) {
      generatePreview();
    }
  }, [imageUrl, preprocessImage, scaleFactor]);

  // 자동 OCR 실행 제거 - 수동으로만 실행

  // Google Vision API로 OCR 수행
  const performGoogleVisionOCR = async (imageUrl: string): Promise<string> => {
    try {
      // 이미지를 base64로 변환
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // data:image/png;base64, 부분 제거
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(blob);
      });

      // Google Vision API 호출
      const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1
                }
              ]
            }
          ]
        })
      });

      if (!visionResponse.ok) {
        throw new Error(`Google Vision API 오류: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      
      if (visionData.responses && visionData.responses[0] && visionData.responses[0].textAnnotations) {
        return visionData.responses[0].textAnnotations[0].description || '';
      } else {
        return '텍스트를 찾을 수 없습니다.';
      }
    } catch (error) {
      console.error('Google Vision API 오류:', error);
      throw error;
    }
  };

  // 이미지 크롭 함수
  const cropImage = (img: HTMLImageElement): Promise<string> => {
    return new Promise((resolve) => {
      if (!selectedArea) {
        resolve(img.src);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(img.src);
        return;
      }

      // 크롭할 영역 크기로 캔버스 설정
      canvas.width = selectedArea.width;
      canvas.height = selectedArea.height;

      // 선택된 영역만 그리기
      ctx.drawImage(
        img,
        selectedArea.x, selectedArea.y, selectedArea.width, selectedArea.height, // 소스 영역
        0, 0, selectedArea.width, selectedArea.height // 대상 영역
      );

      resolve(canvas.toDataURL('image/png'));
    });
  };

  // 미리보기 생성 함수
  const generatePreview = async () => {
    if (!imageUrl || (!preprocessImage && scaleFactor === 1)) {
      setPreprocessedImageUrl(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        const processed = await preprocessImageData(img, true); // 미리보기용
        setPreprocessedImageUrl(processed);
      } catch (error) {
        console.error('Preview generation error:', error);
      }
    };
    
    img.src = imageUrl;
  };

  // 이미지 전처리 함수
  const preprocessImageData = (img: HTMLImageElement, isPreview: boolean = false): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = isPreview ? previewCanvasRef.current : canvasRef.current;
      if (!canvas) {
        resolve(imageUrl);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      // 캔버스 크기를 확대 비율에 맞게 설정
      canvas.width = img.width * scaleFactor;
      canvas.height = img.height * scaleFactor;

      // 이미지를 확대하여 그리기
      ctx.imageSmoothingEnabled = false; // 픽셀화 방지
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (preprocessImage) {
        // 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 흑백 변환 및 대비 향상
        for (let i = 0; i < data.length; i += 4) {
          // RGB를 흑백으로 변환 (가중평균)
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // 대비 향상 (임계값 적용)
          const threshold = 128;
          const binaryColor = gray > threshold ? 255 : 0;
          
          data[i] = binaryColor;     // R
          data[i + 1] = binaryColor; // G
          data[i + 2] = binaryColor; // B
          // data[i + 3]는 알파값이므로 그대로 둠
        }

        // 처리된 이미지 데이터를 캔버스에 다시 그리기
        ctx.putImageData(imageData, 0, 0);
      }

      // 캔버스를 데이터 URL로 변환
      resolve(canvas.toDataURL('image/png'));
    });
  };

  const performOCR = async () => {
    if (ocrEngine === 'google-vision' && !googleVisionApiKey.trim()) {
      alert('Google Vision API 키를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      let processedImageUrl = imageUrl;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      processedImageUrl = await new Promise<string>((resolve, reject) => {
        img.onload = async () => {
          try {
            // 1. 먼저 선택된 영역 크롭 (선택된 경우)
            let croppedImageUrl = img.src;
            if (selectedArea) {
              croppedImageUrl = await cropImage(img);
            }

            // 2. 크롭된 이미지에 전처리 적용 (필요한 경우)
            if (preprocessImage || scaleFactor !== 1) {
              const croppedImg = new Image();
              croppedImg.crossOrigin = 'anonymous';
              croppedImg.onload = async () => {
                try {
                  const processed = await preprocessImageData(croppedImg);
                  resolve(processed);
                } catch (error) {
                  reject(error);
                }
              };
              croppedImg.onerror = reject;
              croppedImg.src = croppedImageUrl;
            } else {
              resolve(croppedImageUrl);
            }
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = reject;
        img.src = imageUrl;
      });

      let result = '';

      if (ocrEngine === 'google-vision') {
        // Google Vision API 사용
        setProgress(50);
        result = await performGoogleVisionOCR(processedImageUrl);
        setProgress(100);
      } else {
        // Tesseract 사용
        const worker = await createWorker(language, 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          }
        });

        // Tesseract 옵션 설정
        await worker.setParameters({
          tessedit_pageseg_mode: parseInt(psmMode) as any,
          tessedit_char_whitelist: '', // 모든 문자 허용
          tessedit_ocr_engine_mode: '1', // LSTM OCR 엔진 사용
        });

        const { data: { text } } = await worker.recognize(processedImageUrl);
        
        await worker.terminate();
        result = text.trim();
      }
      
      setOcrResult(result);
      onOcrResult(result, ocrEngine === 'google-vision' ? 'Google Vision AI' : 'Tesseract');
    } catch (error) {
      console.error('OCR Error:', error);
      const errorMessage = `${ocrEngine === 'google-vision' ? 'Google Vision' : 'Tesseract'} 텍스트 인식 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`;
      setOcrResult(errorMessage);
      onOcrResult(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="ocr-controls">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={previewCanvasRef} style={{ display: 'none' }} />
      
      {/* OCR 상태 메시지 */}
      <div className="ocr-status-header">
        {isProcessing ? (
          <div className="status-processing">
            <span className="status-icon">🔄</span>
            <span className="status-text">텍스트 인식 중...</span>
          </div>
        ) : ocrResult ? (
          <div className="status-ready">
            <span className="status-icon">✅</span>
            <span className="status-text">텍스트 인식 완료!</span>
          </div>
        ) : (
          <div className="status-ready">
            <span className="status-icon">📝</span>
            <span className="status-text">설정을 조정한 후 "텍스트 인식 시작" 버튼을 눌러주세요</span>
          </div>
        )}
      </div>
      
      {/* 전처리 상태 표시 */}
      {(preprocessImage || scaleFactor !== 1 || selectedArea) && (
        <div className="processing-status">
          {selectedArea && (
            <div className="status-item">
              <span className="status-icon">🎯</span>
              <span className="status-text">
                선택 영역 분석 중 ({Math.round(selectedArea.width)} × {Math.round(selectedArea.height)}px)
              </span>
            </div>
          )}
          {(preprocessImage || scaleFactor !== 1) && (
            <div className="status-item">
              <span className="status-icon">⚡</span>
              <span className="status-text">
                {preprocessImage && scaleFactor !== 1 ? 
                  `이미지 전처리 + ${scaleFactor}배 확대 적용됨` :
                  preprocessImage ? '이미지 전처리 적용됨' :
                  `${scaleFactor}배 확대 적용됨`
                }
              </span>
            </div>
          )}
        </div>
      )}
      
      <div className="controls-grid">
        <div className="engine-selector">
          <label htmlFor="engine">OCR 엔진:</label>
          <select
            id="engine"
            value={ocrEngine}
            onChange={(e) => setOcrEngine(e.target.value as 'tesseract' | 'google-vision')}
            disabled={isProcessing}
          >
            <option value="tesseract">Tesseract (무료)</option>
            <option value="google-vision">Google Vision AI</option>
          </select>
        </div>

        {ocrEngine === 'tesseract' && (
          <div className="language-selector">
            <label htmlFor="language">언어 선택:</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isProcessing}
            >
              <option value="kor+eng">한국어 + 영어</option>
              <option value="kor">한국어</option>
              <option value="eng">영어</option>
              <option value="jpn">일본어</option>
              <option value="chi_sim">중국어 (간체)</option>
            </select>
          </div>
        )}

        <div className="scale-selector">
          <label htmlFor="scale">이미지 확대:</label>
          <select
            id="scale"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
            disabled={isProcessing}
          >
            <option value="1">원본 크기</option>
            <option value="1.5">1.5배</option>
            <option value="2">2배 (권장)</option>
            <option value="3">3배</option>
            <option value="4">4배</option>
          </select>
        </div>

        {ocrEngine === 'tesseract' && (
          <div className="psm-selector">
            <label htmlFor="psm">텍스트 레이아웃:</label>
            <select
              id="psm"
              value={psmMode}
              onChange={(e) => setPsmMode(e.target.value)}
              disabled={isProcessing}
            >
              <option value="3">완전 자동 (기본)</option>
              <option value="6">단일 텍스트 블록</option>
              <option value="7">단일 텍스트 줄</option>
              <option value="8">단일 단어</option>
              <option value="10">단일 문자</option>
              <option value="11">스파스 텍스트</option>
              <option value="12">OSD 없는 스파스 텍스트</option>
              <option value="13">Raw 라인 (Tesseract만)</option>
            </select>
          </div>
        )}
      </div>

      {ocrEngine === 'google-vision' && (
        <div className="google-vision-config">
          <div className="api-key-input">
            <label htmlFor="apiKey">Google Vision API 키:</label>
            <input
              type="password"
              id="apiKey"
              value={googleVisionApiKey}
              onChange={(e) => setGoogleVisionApiKey(e.target.value)}
              placeholder="Google Cloud Console에서 발급받은 API 키를 입력하세요"
              disabled={isProcessing}
            />
          </div>
          <div className="api-info">
            <p>💡 <strong>Google Vision API 사용 방법:</strong></p>
            <ol>
              <li>Google Cloud Console에서 프로젝트 생성</li>
              <li>Vision API 활성화</li>
              <li>API 키 생성 및 입력</li>
            </ol>
          </div>
        </div>
      )}

      <div className="preprocessing-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={preprocessImage}
            onChange={(e) => setPreprocessImage(e.target.checked)}
            disabled={isProcessing}
          />
          이미지 전처리 (흑백 변환 + 대비 향상)
        </label>
      </div>
      
      <button
        onClick={performOCR}
        disabled={isProcessing || (ocrEngine === 'google-vision' && !googleVisionApiKey.trim())}
        className="ocr-button"
      >
        {isProcessing ? 
          `${ocrEngine === 'google-vision' ? 'Google Vision' : 'Tesseract'} 텍스트 인식 중...` : 
          `${ocrEngine === 'google-vision' ? 'Google Vision' : 'Tesseract'} 텍스트 인식 시작`
        }
      </button>
      
      {isProcessing && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">{progress}%</span>
        </div>
      )}

      {/* OCR 결과 표시 */}
      {ocrResult && (
        <div className="ocr-result-section">
          <h4>📄 인식된 텍스트:</h4>
          <div className="result-container">
            <div className="result-text">
              <pre>{ocrResult}</pre>
            </div>
            <div className="result-actions">
              <button
                onClick={() => navigator.clipboard.writeText(ocrResult)}
                className="copy-button"
              >
                📋 클립보드에 복사
              </button>
              <button
                onClick={() => setOcrResult('')}
                className="clear-button"
              >
                🗑️ 결과 지우기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ocr-tips">
        <h4>💡 인식률 향상 팁:</h4>
        <ul>
          <li>작은 텍스트는 <strong>이미지 확대</strong>를 사용하세요</li>
          <li>단일 줄 텍스트는 <strong>"단일 텍스트 줄"</strong> 레이아웃을 선택하세요</li>
          <li>배경이 복잡하면 <strong>이미지 전처리</strong>를 활성화하세요</li>
          <li>스크린샷 품질이 중요합니다 - 고해상도로 캡쳐하세요</li>
        </ul>
      </div>
    </div>
  );
};

export default OCRResult; 