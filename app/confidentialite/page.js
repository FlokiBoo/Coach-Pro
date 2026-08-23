export const metadata = { title: 'Politique de confidentialité — OSTRYK' }

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 28 }}>
    <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 19, marginBottom: 10 }}>{title}</h2>
    <div className="font-editorial" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text2)' }}>{children}</div>
  </section>
)

export default function ConfidentialitePage() {
  return (
    <div style={{ background: 'var(--bg2)', minHeight: '100svh', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '36px 32px' }}>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Politique de confidentialité</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32 }}>Dernière mise à jour : 23 août 2026</div>

        <Section title="1. Qui sommes-nous">
          <p>
            OSTRYK est un service de coaching sportif en ligne édité par [Nom légal / statut (auto-entrepreneur, société…) à compléter],
            [adresse à compléter], [SIRET à compléter si applicable.]
            <br />Contact : <a href="mailto:maxx7796@gmail.com" style={{ color: 'var(--green)' }}>maxx7796@gmail.com</a>.
          </p>
          <p>Le responsable du traitement des données décrites ci-dessous est l&apos;éditeur d&apos;OSTRYK.</p>
        </Section>

        <Section title="2. Quelles données nous collectons">
          <p>Dans le cadre de l&apos;utilisation d&apos;OSTRYK, nous traitons :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Identité et contact :</strong> nom, adresse email, mot de passe (stocké de façon chiffrée, jamais en clair).</li>
            <li><strong>Profil sportif :</strong> date de naissance, sexe, taille, poids — utilisés pour personnaliser tes programmes et calculer tes objectifs nutritionnels.</li>
            <li><strong>Données d&apos;entraînement :</strong> programmes suivis, séances réalisées, performances, records, notes de progression.</li>
            <li><strong>Données de paiement :</strong> en cas d&apos;abonnement, le paiement est traité par Stripe. Nous ne stockons jamais ton numéro de carte bancaire — seulement un identifiant client Stripe permettant de gérer ton abonnement.</li>
            <li><strong>Données techniques :</strong> appareils utilisés pour te connecter (limités à 2 par compte pour la sécurité), historique de connexion.</li>
          </ul>
        </Section>

        <Section title="3. Pourquoi nous les utilisons">
          <p>Ces données servent exclusivement à :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li>fournir le service (programmes, suivi, générateur de plans alimentaires) ;</li>
            <li>gérer ton compte et, le cas échéant, ton abonnement ;</li>
            <li>assurer la sécurité de ton compte (protection contre les accès non autorisés) ;</li>
            <li>améliorer le service.</li>
          </ul>
          <p>Nous ne vendons ni ne louons tes données à des tiers, et nous ne les utilisons pas à des fins publicitaires.</p>
        </Section>

        <Section title="4. Avec qui nous les partageons">
          <p>Certains prestataires techniques traitent tes données pour notre compte, dans le seul cadre du fonctionnement du service :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Supabase</strong> (hébergement de la base de données et authentification) ;</li>
            <li><strong>Vercel</strong> (hébergement de l&apos;application) ;</li>
            <li><strong>Stripe</strong> (traitement des paiements par abonnement) ;</li>
            <li>le cas échéant, des services tiers de recherche alimentaire (Open Food Facts, Spoonacular) recevant uniquement le terme recherché, jamais ton identité.</li>
          </ul>
          <p>Ces prestataires n&apos;ont pas le droit d&apos;utiliser tes données à d&apos;autres fins que celles pour lesquelles ils sont mandatés.</p>
        </Section>

        <Section title="5. Combien de temps nous les conservons">
          <p>
            Tes données sont conservées tant que ton compte est actif. Si tu supprimes ton compte ou en fais la demande,
            tes données personnelles sont supprimées dans un délai raisonnable, sauf obligation légale de conservation
            (ex. documents de facturation).
          </p>
        </Section>

        <Section title="6. Tes droits">
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD), tu disposes d&apos;un droit d&apos;accès,
            de rectification, d&apos;effacement, de portabilité et d&apos;opposition sur tes données. Tu peux exercer ces droits
            en écrivant à <a href="mailto:maxx7796@gmail.com" style={{ color: 'var(--green)' }}>maxx7796@gmail.com</a>.
            Tu peux également introduire une réclamation auprès de la CNIL (www.cnil.fr).
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p>
            Les échanges avec OSTRYK sont chiffrés (HTTPS). Les mots de passe sont stockés sous forme chiffrée. L&apos;accès
            à tes données est limité à ton coach et aux personnes strictement nécessaires au bon fonctionnement du service.
          </p>
        </Section>

        <Section title="8. Cookies et stockage local">
          <p>
            OSTRYK utilise uniquement des cookies et un stockage local techniques, nécessaires à ta connexion et au bon
            fonctionnement de l&apos;application (session, préférences d&apos;affichage). Aucun cookie publicitaire ou de
            traçage tiers n&apos;est utilisé à ce jour.
          </p>
        </Section>

        <Section title="9. Mineurs">
          <p>
            OSTRYK s&apos;adresse en priorité à un public majeur. Un mineur ne peut créer de compte qu&apos;avec
            l&apos;accord et sous la responsabilité de son représentant légal.
          </p>
        </Section>

        <Section title="10. Modifications">
          <p>
            Cette politique peut être mise à jour, notamment si de nouvelles fonctionnalités (par exemple un assistant
            IA) sont ajoutées au service. La date de mise à jour en haut de cette page est actualisée à chaque changement.
          </p>
        </Section>
      </div>
    </div>
  )
}
