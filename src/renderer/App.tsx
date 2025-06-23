import { useEffect, useState } from 'react';
import './App.css';
import ImageSelector from './components/ImageSelector';
import OCRResult from './components/OCRResult';
import ScreenCapture from './components/ScreenCapture';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

function App() {
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [selectedImagesForStacking, setSelectedImagesForStacking] = useState<string[]>([]);
  const [stackedImage, setStackedImage] = useState<string | null>(null);
  const [stackingResult, setStackingResult] = useState<{
    originalImages: string[];
    stackedImage: string;
    timestamp: Date;
  } | null>(null);
  const [selectedArea, setSelectedArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // 워크플로우 단계 관리
  const [currentStep, setCurrentStep] = useState(1);
  const [finalProcessedImage, setFinalProcessedImage] = useState<string | null>(null);
  const [preprocessSettings, setPreprocessSettings] = useState({
    enabled: true,
    scaleFactor: 2
  });

  useEffect(() => {
    loadScreenSources();
    
    // 글로벌 단축키로 캡쳐된 이미지 수신
    if (window.electronAPI) {
      window.electronAPI.onScreenCaptured((imageBuffer: Buffer) => {
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
      });
    }
  }, []);

  const loadScreenSources = async () => {
    if (window.electronAPI) {
      try {
        const sources = await window.electronAPI.getScreenSources();
        setScreenSources(sources);
      } catch (error) {
        console.error('Error loading screen sources:', error);
      }
    }
  };

  const handleCapture = async (sourceId: string) => {
    if (window.electronAPI) {
      setIsLoading(true);
      try {
        const imageBuffer = await window.electronAPI.captureSource(sourceId);
        if (imageBuffer) {
          const blob = new Blob([imageBuffer], { type: 'image/png' });
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          
          // 이미지 히스토리에 추가 (최대 5개까지)
          setCapturedImages(prev => {
            const newImages = [imageUrl, ...prev.slice(0, 4)];
            return newImages;
          });
        }
      } catch (error) {
        console.error('Error capturing screen:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOcrResult = (result: string, engine?: string) => {
    setOcrResult(result);
    if (engine) {
      setOcrEngine(engine);
    }
  };

  // 전체 초기화 함수
  const resetAll = () => {
    setCapturedImage(null);
    setOcrResult('');
    setOcrEngine('');
    setCapturedImages([]);
    setSelectedImagesForStacking([]);
    setStackedImage(null);
    setStackingResult(null);
    setSelectedArea(null);
    setIsSelecting(false);
    setCurrentStep(1);
    setFinalProcessedImage(null);
    setPreprocessSettings({
      enabled: true,
      scaleFactor: 2
    });
  };

  // 이미지 스택킹 선택 토글
  const toggleImageForStacking = (imageUrl: string) => {
    setSelectedImagesForStacking(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl);
      } else {
        return [...prev, imageUrl];
      }
    });
  };

  // 이미지 세로 연결 수행
  const performImageConcatenation = async () => {
    if (selectedImagesForStacking.length < 2) {
      alert('최소 2개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const images = await Promise.all(
        selectedImagesForStacking.map(url => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        })
      );

      if (images.length === 0) return;

      // 가장 넓은 이미지의 너비를 기준으로 설정
      const maxWidth = Math.max(...images.map(img => img.width));
      
      // 모든 이미지의 높이를 합산
      const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
      
      // 캔버스 크기 설정
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      
      // 배경을 흰색으로 설정
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 이미지들을 세로로 연결
      let currentY = 0;
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // 이미지를 중앙 정렬로 배치
        const x = (maxWidth - img.width) / 2;
        
        ctx.drawImage(img, x, currentY, img.width, img.height);
        currentY += img.height;
      }

      const concatenatedImageUrl = canvas.toDataURL('image/png', 1.0);
      
      // 연결 결과 저장
      setStackingResult({
        originalImages: [...selectedImagesForStacking],
        stackedImage: concatenatedImageUrl,
        timestamp: new Date()
      });
      
      setStackedImage(concatenatedImageUrl);
      setCapturedImage(concatenatedImageUrl);
      
      // 연결된 이미지를 히스토리에 추가
      setCapturedImages(prev => [concatenatedImageUrl, ...prev.slice(0, 4)]);
      
      // 선택 해제
      setSelectedImagesForStacking([]);
      
      // 연결 완료 후 수동으로 다음 단계 진행
      
    } catch (error) {
      console.error('Image concatenation error:', error);
      alert('이미지 연결 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 최종 이미지 생성 (전처리 적용)
  const generateFinalImage = async () => {
    if (!capturedImage) return;
    
    setIsLoading(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const processedImageUrl = await new Promise<string>((resolve, reject) => {
        img.onload = async () => {
          try {
            if (!preprocessSettings.enabled && preprocessSettings.scaleFactor === 1) {
              resolve(img.src);
              return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(img.src);
              return;
            }

            // 캔버스 크기를 확대 비율에 맞게 설정
            canvas.width = img.width * preprocessSettings.scaleFactor;
            canvas.height = img.height * preprocessSettings.scaleFactor;

            // 이미지를 확대하여 그리기
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (preprocessSettings.enabled) {
              // 이미지 데이터 가져오기
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;

              // 흑백 변환 및 대비 향상
              for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                const threshold = 128;
                const binaryColor = gray > threshold ? 255 : 0;
                
                data[i] = binaryColor;
                data[i + 1] = binaryColor;
                data[i + 2] = binaryColor;
              }

              ctx.putImageData(imageData, 0, 0);
            }

            resolve(canvas.toDataURL('image/png'));
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = reject;
        img.src = capturedImage;
      });

      setFinalProcessedImage(processedImageUrl);
      setCurrentStep(4);
      
    } catch (error) {
      console.error('Image processing error:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="title-section">
            <h1>화면 캡쳐 & 글자 인식</h1>
            <p>Ctrl+Shift+C로 빠른 캡쳐 가능</p>
          </div>
          <button 
            className="reset-all-btn"
            onClick={resetAll}
            title="모든 데이터 초기화"
          >
            🔄 전체 초기화
          </button>
        </div>
      </header>
      
      <div className="app-content">
        {/* 단계별 진행 표시 */}
        <div className="workflow-steps">
          <div className={`step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-text">화면 캡쳐</span>
          </div>
          <div className={`step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-text">이미지 스택킹 (선택)</span>
          </div>
          <div className={`step ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-text">전처리 설정</span>
          </div>
          <div className={`step ${currentStep >= 4 ? 'completed' : ''} ${currentStep === 4 ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-text">영역 선택</span>
          </div>
          <div className={`step ${currentStep >= 5 ? 'completed' : ''} ${currentStep === 5 ? 'active' : ''}`}>
            <span className="step-number">5</span>
            <span className="step-text">OCR 분석</span>
          </div>
        </div>

        {/* 단계 1: 화면 캡쳐 */}
        {currentStep === 1 && (
          <div className="step-content">
            <h3>🖥️ 단계 1: 화면 캡쳐</h3>
            <p>스택킹을 원한다면 여러 번 캡쳐하세요. 충분히 캡쳐한 후 다음 단계로 진행하세요.</p>
            
            <ScreenCapture
              screenSources={screenSources}
              onCapture={handleCapture}
              onRefresh={loadScreenSources}
              isLoading={isLoading}
            />

            {/* 캡쳐된 이미지들 미리보기 */}
            {capturedImages.length > 0 && (
              <div className="captured-images-preview">
                <h4>📷 캡쳐된 이미지들 ({capturedImages.length}개)</h4>
                <div className="preview-grid">
                  {capturedImages.map((imgUrl, index) => (
                    <div key={index} className="preview-item">
                      <img src={imgUrl} alt={`Capture ${index + 1}`} />
                      <span className="preview-label">{index + 1}</span>
                    </div>
                  ))}
                </div>
                
                <div className="step-actions">
                  <button 
                    className="next-step-btn"
                    onClick={() => setCurrentStep(2)}
                  >
                    다음 단계: 이미지 연결 ({capturedImages.length}개 이미지)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 단계 2: 이미지 연결 (선택사항) */}
        {currentStep === 2 && capturedImage && (
          <div className="step-content">
            <h3>📚 단계 2: 이미지 세로 연결 (선택사항)</h3>
            <p>여러 이미지를 세로로 연결하여 긴 문서를 만들 수 있습니다. 스크롤되는 긴 텍스트나 여러 페이지에 걸친 내용을 하나로 합치는데 유용합니다.</p>
            
            <div className="current-image-preview">
              <h4>현재 선택된 이미지</h4>
              <img src={capturedImage} alt="Current" style={{ maxWidth: '300px', maxHeight: '200px' }} />
            </div>

            {capturedImages.length > 1 && (
              <div className="image-history">
                <h4>📷 사용 가능한 이미지들</h4>
                <div className="history-grid">
                  {capturedImages.map((imgUrl, index) => (
                    <div 
                      key={index} 
                      className={`history-item ${selectedImagesForStacking.includes(imgUrl) ? 'selected-for-stacking' : ''}`}
                    >
                      <img src={imgUrl} alt={`Capture ${index + 1}`} />
                      <span className="history-label">
                        {index === 0 ? '최신' : `${index + 1}번째`}
                      </span>
                      <div className="stacking-controls">
                        <label className="stacking-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedImagesForStacking.includes(imgUrl)}
                            onChange={() => toggleImageForStacking(imgUrl)}
                          />
                          <span>연결 선택</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="stacking-section">
                  <div className="stacking-info">
                    <span>선택된 이미지: {selectedImagesForStacking.length}개</span>
                    {selectedImagesForStacking.length >= 2 && (
                      <span className="stacking-tip">✨ 연결 준비 완료!</span>
                    )}
                  </div>
                  <div className="stacking-buttons">
                    <button 
                      className="stack-images-btn"
                      onClick={performImageConcatenation}
                      disabled={selectedImagesForStacking.length < 2 || isLoading}
                    >
                      {isLoading ? '연결 중...' : `${selectedImagesForStacking.length}개 이미지 세로 연결`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="step-actions">
              <button 
                className="skip-step-btn"
                onClick={() => setCurrentStep(3)}
              >
                연결 건너뛰기
              </button>
              {stackedImage && (
                <button 
                  className="next-step-btn"
                  onClick={() => setCurrentStep(3)}
                >
                  연결 완료 - 다음 단계로
                </button>
              )}
            </div>
          </div>
        )}

        {/* 단계 3: 전처리 설정 */}
        {currentStep === 3 && capturedImage && (
          <div className="step-content">
            <h3>⚙️ 단계 3: 전처리 설정</h3>
            <p>이미지 전처리를 통해 OCR 정확도를 향상시킬 수 있습니다.</p>
            
            <div className="preprocess-settings">
              <div className="setting-group">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={preprocessSettings.enabled}
                    onChange={(e) => setPreprocessSettings(prev => ({
                      ...prev,
                      enabled: e.target.checked
                    }))}
                  />
                  <span>흑백 변환 및 대비 향상</span>
                </label>
              </div>
              
              <div className="setting-group">
                <label className="setting-label">이미지 확대 비율:</label>
                <select
                  value={preprocessSettings.scaleFactor}
                  onChange={(e) => setPreprocessSettings(prev => ({
                    ...prev,
                    scaleFactor: parseInt(e.target.value)
                  }))}
                >
                  <option value={1}>1배 (원본)</option>
                  <option value={2}>2배</option>
                  <option value={3}>3배</option>
                  <option value={4}>4배</option>
                </select>
              </div>
            </div>

            <div className="step-actions">
              <button 
                className="process-image-btn"
                onClick={generateFinalImage}
                disabled={isLoading}
              >
                {isLoading ? '이미지 처리 중...' : '이미지 처리 및 다음 단계'}
              </button>
            </div>
          </div>
        )}

        {/* 단계 4: 영역 선택 */}
        {currentStep === 4 && finalProcessedImage && (
          <div className="step-content">
            <h3>🎯 단계 4: 분석할 영역 선택</h3>
            <p>전체 이미지 또는 특정 영역을 선택하여 OCR을 실행할 수 있습니다.</p>
            
            <ImageSelector
              imageUrl={finalProcessedImage}
              onAreaSelect={setSelectedArea}
              selectedArea={selectedArea}
              isSelecting={isSelecting}
              onSelectingChange={setIsSelecting}
            />

            <div className="step-actions">
              <button 
                className="start-ocr-btn"
                onClick={() => setCurrentStep(5)}
              >
                {selectedArea ? '선택 영역 분석 시작' : '전체 이미지 분석 시작'}
              </button>
            </div>
          </div>
        )}

        {/* 단계 5: OCR 분석 */}
        {currentStep === 5 && finalProcessedImage && (
          <div className="step-content">
            <h3>🔍 단계 5: OCR 분석</h3>
            
            <OCRResult
              imageUrl={finalProcessedImage}
              selectedArea={selectedArea}
              onOcrResult={handleOcrResult}
            />

            {ocrResult && (
              <div className="result-section">
                <h4>인식된 텍스트 {ocrEngine && <span className="engine-badge">({ocrEngine})</span>}</h4>
                <div className="ocr-result">
                  <pre>{ocrResult}</pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(ocrResult)}
                    className="copy-button"
                  >
                    클립보드에 복사
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 