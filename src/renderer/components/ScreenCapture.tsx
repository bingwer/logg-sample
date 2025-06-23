import React from 'react';
import './ScreenCapture.css';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

interface ScreenCaptureProps {
  screenSources: ScreenSource[];
  onCapture: (sourceId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const ScreenCapture: React.FC<ScreenCaptureProps> = ({
  screenSources,
  onCapture,
  onRefresh,
  isLoading
}) => {
  return (
    <div className="screen-capture">
      <div className="capture-header">
        <h3>화면/창 선택</h3>
        <button onClick={onRefresh} className="refresh-button">
          새로고침
        </button>
      </div>
      
      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>캡쳐 중...</p>
        </div>
      )}
      
      <div className="sources-grid">
        {screenSources.map((source) => (
          <div
            key={source.id}
            className="source-item"
            onClick={() => onCapture(source.id)}
          >
            <div className="source-thumbnail">
              <img src={source.thumbnail} alt={source.name} />
              <div className="source-overlay">
                <button className="capture-button">캡쳐</button>
              </div>
            </div>
            <div className="source-name">{source.name}</div>
          </div>
        ))}
      </div>
      
      {screenSources.length === 0 && !isLoading && (
        <div className="no-sources">
          <p>사용 가능한 화면이 없습니다.</p>
          <button onClick={onRefresh}>다시 시도</button>
        </div>
      )}
    </div>
  );
};

export default ScreenCapture; 