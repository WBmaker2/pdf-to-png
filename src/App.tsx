function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">브라우저 안에서 변환</p>
        <h1 id="app-title">PDF를 1080p PNG로 변환</h1>
        <p className="hero-copy">
          PDF 파일을 선택하면 각 페이지를 PNG로 만들고, 여러 장이면 ZIP으로 묶어
          다운로드합니다.
        </p>
      </section>
    </main>
  );
}

export default App;
