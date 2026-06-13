import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PeopleManager } from '#/features/people/people-manager.tsx';
import { listPeople } from '#/lib/brain-functions.ts';
import {
  DEFAULT_PEOPLE_SORT_FIELD,
  DEFAULT_PEOPLE_SORT_ORDER,
  EMPTY_COUNT,
  EMPTY_OFFSET,
  PEOPLE_PAGE_SIZE,
} from '#/lib/constants.ts';

export function PeopleView() {
  const peopleQuery = useInfiniteQuery({
    queryKey: ['people', DEFAULT_PEOPLE_SORT_FIELD, DEFAULT_PEOPLE_SORT_ORDER],
    queryFn: ({ pageParam }) =>
      listPeople({
        sortBy: DEFAULT_PEOPLE_SORT_FIELD,
        sortOrder: DEFAULT_PEOPLE_SORT_ORDER,
        limit: PEOPLE_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: EMPTY_OFFSET,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.people.length, EMPTY_COUNT);
      return loaded < lastPage.total ? loaded : undefined;
    },
    retry: false,
  });

  const people = useMemo(
    () => peopleQuery.data?.pages.flatMap((page) => page.people) ?? [],
    [peopleQuery.data],
  );
  const total = peopleQuery.data?.pages[EMPTY_COUNT]?.total ?? EMPTY_COUNT;

  return (
    <PeopleManager
      people={people}
      total={total}
      isLoading={peopleQuery.isLoading}
      isFetching={peopleQuery.isFetching && !peopleQuery.isFetchingNextPage}
      isFetchingNextPage={peopleQuery.isFetchingNextPage}
      hasNextPage={peopleQuery.hasNextPage}
      fetchNextPage={peopleQuery.fetchNextPage}
      error={peopleQuery.error}
    />
  );
}
