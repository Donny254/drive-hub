import { useEffect, useMemo } from "react";
import type { Inquiry, Listing, User } from "@/components/admin/types";

type UseAdminViewStateParams = {
  inquiries: Inquiry[];
  inquiryStatusFilter: Inquiry["status"] | "all";
  inquiriesPage: number;
  listings: Listing[];
  listingStatusFilter: Listing["status"] | "all";
  listingsPage: number;
  setInquiriesPage: React.Dispatch<React.SetStateAction<number>>;
  setListingsPage: React.Dispatch<React.SetStateAction<number>>;
  setUsersPage: React.Dispatch<React.SetStateAction<number>>;
  userSearch: string;
  userVerificationFilter: User["sellerVerificationStatus"] | "all";
  users: User[];
  usersPage: number;
};

const PAGE_SIZE = 10;

export const useAdminViewState = ({
  inquiries,
  inquiryStatusFilter,
  inquiriesPage,
  listings,
  listingStatusFilter,
  listingsPage,
  setInquiriesPage,
  setListingsPage,
  setUsersPage,
  userSearch,
  userVerificationFilter,
  users,
  usersPage,
}: UseAdminViewStateParams) => {
  const flaggedMediaListings = useMemo(
    () =>
      listings
        .filter(
          (listing) =>
            (listing.riskScore ?? 0) >= 35 ||
            (listing.riskFlags?.length ?? 0) > 0 ||
            listing.status === "pending_approval" ||
            listing.status === "rejected"
        )
        .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
        .slice(0, 8),
    [listings]
  );

  const listingsNeedingReview = useMemo(
    () =>
      listings.filter(
        (listing) => listing.status === "pending_approval" || listing.status === "rejected"
      ),
    [listings]
  );

  const filteredListings = useMemo(() => {
    if (listingStatusFilter === "all") return listings;
    return listings.filter((listing) => listing.status === listingStatusFilter);
  }, [listingStatusFilter, listings]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    const base =
      userVerificationFilter === "all"
        ? users
        : users.filter((user) => user.sellerVerificationStatus === userVerificationFilter);
    if (!term) return base;
    return base.filter((user) =>
      [user.name, user.email, user.phone, user.role, user.sellerVerificationStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [userSearch, userVerificationFilter, users]);

  const filteredInquiries = useMemo(() => {
    if (inquiryStatusFilter === "all") return inquiries;
    return inquiries.filter((inquiry) => inquiry.status === inquiryStatusFilter);
  }, [inquiries, inquiryStatusFilter]);

  const listingsPageCount = Math.max(1, Math.ceil(filteredListings.length / PAGE_SIZE));
  const inquiriesPageCount = Math.max(1, Math.ceil(filteredInquiries.length / PAGE_SIZE));
  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

  const paginatedListings = useMemo(
    () => filteredListings.slice((listingsPage - 1) * PAGE_SIZE, listingsPage * PAGE_SIZE),
    [filteredListings, listingsPage]
  );

  const paginatedInquiries = useMemo(
    () => filteredInquiries.slice((inquiriesPage - 1) * PAGE_SIZE, inquiriesPage * PAGE_SIZE),
    [filteredInquiries, inquiriesPage]
  );

  const paginatedUsers = useMemo(
    () => filteredUsers.slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE),
    [filteredUsers, usersPage]
  );

  useEffect(() => {
    setListingsPage(1);
  }, [listingStatusFilter, setListingsPage]);

  useEffect(() => {
    setInquiriesPage(1);
  }, [inquiryStatusFilter, setInquiriesPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, userVerificationFilter, setUsersPage]);

  useEffect(() => {
    setListingsPage((page) => Math.min(page, listingsPageCount));
  }, [listingsPageCount, setListingsPage]);

  useEffect(() => {
    setInquiriesPage((page) => Math.min(page, inquiriesPageCount));
  }, [inquiriesPageCount, setInquiriesPage]);

  useEffect(() => {
    setUsersPage((page) => Math.min(page, usersPageCount));
  }, [usersPageCount, setUsersPage]);

  return {
    filteredInquiries,
    filteredListings,
    filteredUsers,
    flaggedMediaListings,
    inquiriesPageCount,
    listingsNeedingReview,
    listingsPageCount,
    paginatedInquiries,
    paginatedListings,
    paginatedUsers,
    usersPageCount,
  };
};
