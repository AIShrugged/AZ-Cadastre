-- What the office declares about a submission when it takes it in: the ground
-- the claimed right rests on, and the year the building is said to date from.
--
-- Columns on the package and not extracted fields, deliberately. An extracted
-- field is something the engine read off a sheet: it names the document, the
-- page and how well it was read. Neither of these was read off anything — a
-- person typed them — and storing them beside the readings would make the
-- report unable to say which of its own values a human had supplied. Keeping
-- them apart is what lets the branch fall back to a declared year where no
-- paper states one, and what lets the report say the two disagree where both do.
--
-- Both nullable, and every existing row keeps null: a package taken in before
-- intake asked declared nothing, which is a fact about it and not a gap.
ALTER TABLE "verification_packages" ADD COLUMN "declaredLegalBasis" TEXT;
ALTER TABLE "verification_packages" ADD COLUMN "declaredBuiltYear" INTEGER;
