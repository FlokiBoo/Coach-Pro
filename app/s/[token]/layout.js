export async function generateMetadata({ params }) {
  const { token } = await params
  return {
    manifest: `/api/manifest/${token}`,
  }
}

export default function AthleteLayout({ children }) {
  return children
}
