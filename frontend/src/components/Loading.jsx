function Loading({ message = "Loading..." }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}

export default Loading;
