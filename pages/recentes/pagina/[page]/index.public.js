import { getStaticPropsRevalidate } from 'next-swr';

import { ContentList, DefaultLayout, RecentTabNav } from '@/TabNewsUI';
import webserver from 'infra/webserver';
import authorization from 'models/authorization.js';
import content from 'models/content.js';
import user from 'models/user.js';
import validator from 'models/validator.js';

export default function Home({ contentListFound, pagination }) {
  return (
    <>
      <DefaultLayout
        metadata={{
          title: `Página ${pagination.currentPage} · Recentes`,
          description: 'Publicações no TabNews ordenadas pelas mais recentes.',
        }}>
        <RecentTabNav />
        <ContentList contentList={contentListFound} pagination={pagination} paginationBasePath="/recentes/pagina" />
      </DefaultLayout>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: [{ params: { page: '1' } }, { params: { page: '2' } }, { params: { page: '3' } }],
    fallback: 'blocking',
  };
}

export const getStaticProps = getStaticPropsRevalidate(async (context) => {
  const userTryingToGet = user.createAnonymous();

  context.params = context.params ? context.params : {};

  try {
    context.params = validator(context.params, {
      page: 'optional',
      per_page: 'optional',
    });
  } catch (error) {
    return {
      notFound: true,
    };
  }

  const results = await content.findWithStrategy({
    strategy: 'new',
    where: {
      parent_id: null,
      status: 'published',
    },
    page: context.params.page,
    per_page: context.params.per_page,
  });

  const contentListFound = results.rows;

  if (contentListFound.length === 0 && context.params.page !== 1 && !webserver.isBuildTime) {
    const lastValidPage = `/recentes/pagina/${results.pagination.lastPage || 1}`;
    const revalidate = context.params.page > results.pagination.lastPage + 1 ? 10 : 1;

    return {
      redirect: {
        destination: lastValidPage,
      },
      revalidate,
    };
  }

  const secureContentValues = authorization.filterOutput(userTryingToGet, 'read:content:list', contentListFound);

  return {
    props: {
      contentListFound: secureContentValues,
      pagination: results.pagination,
    },
    revalidate: 1,
  };
});
