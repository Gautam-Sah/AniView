function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-message">
      <p>{message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className="retry-btn">
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
