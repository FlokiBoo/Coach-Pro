export const metadata = { title: 'Suppression de compte — OSTRYK' }

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 28 }}>
    <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 19, marginBottom: 10 }}>{title}</h2>
    <div className="font-editorial" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text2)' }}>{children}</div>
  </section>
)

export default function SuppressionComptePage() {
  return (
    <div style={{ background: 'var(--bg2)', minHeight: '100svh', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '36px 32px' }}>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Suppression de compte OSTRYK</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32 }}>Dernière mise à jour : 1 septembre 2026</div>

        <Section title="Comment demander la suppression de ton compte">
          <p>
            Pour demander la suppression de ton compte OSTRYK et des données associées, envoie un email à{' '}
            <a href="mailto:maxx7796@gmail.com?subject=Suppression%20de%20compte%20OSTRYK" style={{ color: 'var(--green)' }}>maxx7796@gmail.com</a>{' '}
            depuis l&apos;adresse email associée à ton compte, en précisant &laquo;&nbsp;Suppression de compte&nbsp;&raquo; dans l&apos;objet.
          </p>
          <p>Ta demande sera traitée dans un délai maximum de 30 jours.</p>
        </Section>

        <Section title="Quelles données sont supprimées">
          <p>À la suppression de ton compte, sont définitivement effacées :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li>ton identité et tes informations de contact (nom, email, mot de passe) ;</li>
            <li>ton profil sportif (date de naissance, sexe, taille, poids, objectifs) ;</li>
            <li>tes données d&apos;entraînement (programmes, séances, performances, records, notes de progression) ;</li>
            <li>tes échanges de messagerie avec ton coach ;</li>
            <li>les appareils associés à ton compte.</li>
          </ul>
        </Section>

        <Section title="Quelles données peuvent être conservées">
          <p>
            Certaines données peuvent être conservées au-delà de la suppression du compte, uniquement lorsque la loi
            l&apos;exige :
          </p>
          <ul style={{ paddingLeft: 20 }}>
            <li>les documents de facturation liés à un abonnement Stripe (obligation légale de conservation comptable, généralement 10 ans) ;</li>
            <li>les informations strictement nécessaires en cas de litige en cours ou de demande d&apos;une autorité compétente.</li>
          </ul>
          <p>
            Pour en savoir plus sur le traitement de tes données, consulte notre{' '}
            <a href="/confidentialite" style={{ color: 'var(--green)' }}>politique de confidentialité</a>.
          </p>
        </Section>
      </div>
    </div>
  )
}
