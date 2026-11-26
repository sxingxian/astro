export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="error m-0">{message}</p> : null;
}
