"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = {
  href?: string;
  label: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  vote: "投票",
  confirm: "確認投票",
  admin: "投票管理",
  results: "開票結果",
  login: "登入",
  bulletin: "公告欄",
  tally: "開票",
  audit: "稽核",
};

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter((part) => part.length > 0);
  if (segments.length === 0) {
    return [];
  }

  const crumbs: Crumb[] = [{ href: "/", label: "首頁" }];
  let path = "";

  for (const [index, segment] of segments.entries()) {
    path += `/${segment}`;
    const isLast = index === segments.length - 1;
    const known = SEGMENT_LABELS[segment];

    let label = known ?? decodeURIComponent(segment);
    if (!known && segments[index - 1] === "vote") {
      label = "專屬投票";
    }

    if (isLast) {
      crumbs.push({ label });
    } else {
      crumbs.push({ href: path, label });
    }
  }

  return crumbs;
}

export function SiteBreadcrumb() {
  const pathname = usePathname() || "/";
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
