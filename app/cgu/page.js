export const metadata = { title: 'CGU & CGV — OSTRYK' }

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 28 }}>
    <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 19, marginBottom: 10 }}>{title}</h2>
    <div className="font-editorial" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text2)' }}>{children}</div>
  </section>
)

export default function CguPage() {
  return (
    <div style={{ background: 'var(--bg2)', minHeight: '100svh', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '36px 32px' }}>
        <div style={{ fontFamily: 'var(--font-title)', color: 'var(--title)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          Conditions générales d&apos;utilisation et de vente
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32 }}>Dernière mise à jour : 23 août 2026</div>

        <Section title="1. Objet">
          <p>
            Les présentes conditions régissent l&apos;utilisation de la plateforme OSTRYK, un service de coaching sportif
            en ligne édité par Maxime Sallenave, auto-entrepreneur, 17 cité Conrad, 33000 Bordeaux, SIRET 905 385 076 00039,
            permettant l&apos;accès à des programmes d&apos;entraînement, un suivi de progression, et un générateur de plans
            alimentaires. Toute création de compte implique l&apos;acceptation pleine et entière des présentes conditions.
          </p>
        </Section>

        <Section title="2. Accès au service">
          <p>
            L&apos;accès à OSTRYK nécessite la création d&apos;un compte personnel (identifiants confidentiels, à usage
            strictement personnel et non transférable). Le client s&apos;engage à fournir des informations exactes,
            notamment concernant ses données physiques (taille, poids, âge), utilisées pour personnaliser son
            accompagnement.
          </p>
        </Section>

        <Section title="3. Offres et tarifs">
          <p>OSTRYK propose les formules d&apos;abonnement suivantes, sans engagement de durée :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Accès Site</strong> — 19,99 € / mois : accès complet aux programmes, au suivi et aux outils du site.</li>
            <li><strong>Accès Site + échange hebdomadaire</strong> — 49,99 € / mois : formule ci-dessus, incluant un échange hebdomadaire (vidéo ou question) avec le coach.</li>
          </ul>
          <p>
            Les tarifs sont indiqués en euros, toutes taxes comprises. OSTRYK se réserve le droit de faire évoluer ses
            tarifs ; toute modification sera communiquée au client avant son entrée en vigueur pour les abonnements en cours.
          </p>
        </Section>

        <Section title="4. Paiement, durée et résiliation">
          <p>
            Le paiement s&apos;effectue par carte bancaire via Stripe, prestataire de paiement sécurisé. L&apos;abonnement
            est mensuel et se renouvelle automatiquement par tacite reconduction, sauf résiliation par le client.
          </p>
          <p>
            Le client peut résilier son abonnement à tout moment depuis son espace personnel. La résiliation prend effet
            à la fin de la période de facturation en cours ; aucun remboursement au prorata de la période entamée n&apos;est
            effectué, sauf disposition légale contraire.
          </p>
          <p>
            <strong>Droit de rétractation :</strong> conformément à l&apos;article L221-28 du Code de la consommation, en
            souscrivant un abonnement, le client demande expressément un accès immédiat au service et reconnaît renoncer
            à son droit de rétractation de 14 jours une fois l&apos;exécution du service commencée avec son accord.
          </p>
        </Section>

        <Section title="5. Avertissement santé">
          <p>
            Les programmes proposés sur OSTRYK sont des conseils sportifs et nutritionnels généraux et ne remplacent pas
            un avis médical. Il est recommandé de consulter un médecin avant de débuter tout programme d&apos;entraînement,
            notamment en cas de doute sur son état de santé, de grossesse, de blessure ou de pathologie préexistante.
          </p>
          <p>
            Le client est seul responsable de signaler à son coach toute condition médicale pertinente. OSTRYK et son
            coach ne sauraient être tenus responsables des conséquences résultant d&apos;une pratique inadaptée à l&apos;état
            de santé du client ou du non-respect des consignes données.
          </p>
        </Section>

        <Section title="6. Propriété intellectuelle">
          <p>
            Les programmes, contenus, vidéos et méthodes disponibles sur OSTRYK sont la propriété de leur auteur et
            protégés au titre de la propriété intellectuelle. Le client bénéficie d&apos;un droit d&apos;usage strictement
            personnel, non cessible, pour la durée de son abonnement. Toute reproduction, diffusion ou revente sans
            autorisation est interdite.
          </p>
        </Section>

        <Section title="7. Données personnelles">
          <p>
            Le traitement des données personnelles dans le cadre d&apos;OSTRYK est décrit dans notre{' '}
            <a href="/confidentialite" style={{ color: 'var(--green)' }}>politique de confidentialité</a>.
          </p>
        </Section>

        <Section title="8. Responsabilité">
          <p>
            OSTRYK met tout en œuvre pour assurer la disponibilité et la fiabilité du service, sans garantie de
            fonctionnement ininterrompu. OSTRYK ne saurait être tenu responsable des interruptions temporaires liées à
            la maintenance ou à des causes indépendantes de sa volonté.
          </p>
        </Section>

        <Section title="9. Modification des conditions">
          <p>
            OSTRYK peut modifier les présentes conditions à tout moment. Les clients seront informés de toute
            modification substantielle. La poursuite de l&apos;utilisation du service après modification vaut acceptation
            des nouvelles conditions.
          </p>
        </Section>

        <Section title="10. Droit applicable et litiges">
          <p>
            Les présentes conditions sont soumises au droit français. Conformément aux articles L616-1 et suivants du
            Code de la consommation, le client peut recourir gratuitement, après démarche écrite préalable auprès
            d&apos;OSTRYK restée infructueuse, à un médiateur de la consommation en vue de la résolution amiable d&apos;un
            litige n&apos;ayant pas trouvé de solution, dans un délai maximal d&apos;un an à compter de sa réclamation écrite.
            OSTRYK a choisi comme médiateur de la consommation le Centre de la Médiation de la Consommation de
            Conciliateurs de Justice (CM2C), joignable :
          </p>
          <ul style={{ paddingLeft: 20 }}>
            <li>par voie électronique, via le formulaire disponible sur <a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>www.cm2c.net</a> ;</li>
            <li>par voie postale, à l&apos;adresse : CM2C — 49 rue de Ponthieu — 75008 Paris.</li>
          </ul>
          <p>
            À défaut de résolution amiable, les tribunaux français compétents seront seuls saisis.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Pour toute question relative aux présentes conditions :{' '}
            <a href="mailto:maxx7796@gmail.com" style={{ color: 'var(--green)' }}>maxx7796@gmail.com</a>.
          </p>
        </Section>
      </div>
    </div>
  )
}
